import { prisma } from '@/lib/db';
import { isFreeEmail, extractDomainFromEmail, slugify } from '@/lib/utils';
import { validateDomainHasLogo } from '@/lib/company-logo';
import OpenAI from 'openai';

// Apollo.io Organization Enrichment API
const APOLLO_API = 'https://api.apollo.io/api/v1/organizations/enrich';

// Z.ai client for AI-generated descriptions (fallback when Apollo has no data)
let zaiClient: OpenAI | null = null;

function getZaiClient(): OpenAI | null {
  if (!process.env.ZAI_API_KEY) return null;
  if (!zaiClient) {
    zaiClient = new OpenAI({
      apiKey: process.env.ZAI_API_KEY,
      baseURL: 'https://api.z.ai/api/paas/v4',
    });
  }
  return zaiClient;
}

const DESCRIPTION_PROMPT = `Generate a detailed company description (2-3 paragraphs, 800-1200 characters) based on the company name and website domain.

Structure:
1. First paragraph: Company overview - what they do, industry, when/where founded if inferable from name
2. Second paragraph: Main products/services, key features, target audience
3. Third paragraph (optional): Notable achievements, market position, or unique value proposition

Style guidelines:
- Professional, informative tone
- Use specific details where possible
- Avoid generic marketing phrases
- Write in third person

Return ONLY the description text, no headers or formatting.`;

/**
 * Generate company description using Z.ai when Apollo doesn't have data
 */
async function generateCompanyDescriptionWithAI(name: string, domain: string): Promise<string | null> {
  const zai = getZaiClient();
  if (!zai) {
    console.log('[Z.ai] API key not configured, skipping AI description');
    return null;
  }

  try {
    console.log(`[Z.ai] Generating description for ${name} (${domain})`);

    const response = await zai.chat.completions.create({
      model: 'glm-4-32b-0414-128k',
      messages: [
        { role: 'system', content: DESCRIPTION_PROMPT },
        { role: 'user', content: `Company: ${name}\nWebsite: ${domain}` }
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const description = response.choices[0]?.message?.content?.trim();

    if (description && description.length > 50) {
      console.log(`[Z.ai] Generated description for ${name}: ${description.length} chars`);
      return description;
    }

    console.log(`[Z.ai] Empty or too short response for ${name}`);
    return null;
  } catch (error) {
    console.error(`[Z.ai] Error generating description for ${name}:`, error);
    return null;
  }
}

// Response structure from Apollo Organization Enrichment API
interface ApolloOrganization {
  id?: string;
  name?: string;
  website_url?: string;
  logo_url?: string;
  short_description?: string;
  industry?: string;
  estimated_num_employees?: number;
  linkedin_url?: string;
  twitter_url?: string;
  facebook_url?: string;
  city?: string;
  state?: string;
  country?: string;
  street_address?: string;
  postal_code?: string;
  phone?: string;
  founded_year?: number;
  keywords?: string[];
  annual_revenue?: number;
}

interface ApolloResponse {
  organization: ApolloOrganization | null;
}

// Enrichment stats
export interface EnrichmentStats {
  total: number;
  enriched: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// Map company size from employee count
function mapCompanySize(employees?: number): 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null {
  if (!employees) return null;

  if (employees <= 10) return 'STARTUP';
  if (employees <= 50) return 'SMALL';
  if (employees <= 200) return 'MEDIUM';
  if (employees <= 1000) return 'LARGE';
  return 'ENTERPRISE';
}

// Format headquarters from Apollo location
function formatHeadquarters(org: ApolloOrganization): string | null {
  const parts = [org.city, org.state, org.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// Fetch company data from Apollo API
async function fetchCompanyFromApollo(domain: string): Promise<ApolloOrganization | null> {
  const apolloApiKey = process.env.APOLLO_API_KEY1;

  if (!apolloApiKey) {
    console.warn('APOLLO_API_KEY1 not set, skipping enrichment');
    return null;
  }

  try {
    console.log(`Fetching Apollo data for domain: ${domain}`);

    const url = `${APOLLO_API}?domain=${encodeURIComponent(domain)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apolloApiKey,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Apollo API response status: ${response.status}`);

    if (response.status === 404) {
      console.log(`No Apollo data found for domain: ${domain}`);
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`Apollo API error: ${response.status} - ${text.substring(0, 500)}`);
      throw new Error(`Apollo API error: ${response.status}`);
    }

    const data: ApolloResponse = await response.json();

    if (!data.organization) {
      console.log(`No organization data from Apollo for: ${domain}`);
      return null;
    }

    console.log(`Apollo returned data for ${domain}: name=${data.organization.name}, logo=${!!data.organization.logo_url}, desc=${!!data.organization.short_description}`);

    return data.organization;
  } catch (error) {
    console.error(`Error fetching Apollo data for ${domain}:`, error);
    throw error;
  }
}

// Update company with enriched data from Apollo
async function updateCompanyWithApolloData(
  companyId: string,
  org: ApolloOrganization,
  domain: string
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  // Update company name and slug if Apollo has a better one
  if (org.name) {
    updateData.name = org.name;
    // Generate new slug from Apollo company name
    const newSlug = slugify(org.name);
    // Check if slug is available
    const existingWithSlug = await prisma.company.findFirst({
      where: { slug: newSlug, NOT: { id: companyId } },
    });
    if (!existingWithSlug) {
      updateData.slug = newSlug;
    }
  }

  if (org.logo_url) updateData.logo = org.logo_url;
  if (org.short_description) updateData.description = org.short_description;
  if (org.industry) updateData.industry = org.industry;

  updateData.website = org.website_url || `https://${domain}`;

  if (org.linkedin_url) updateData.linkedinUrl = org.linkedin_url;

  const headquarters = formatHeadquarters(org);
  if (headquarters) updateData.headquarters = headquarters;

  const size = mapCompanySize(org.estimated_num_employees);
  if (size) updateData.size = size;

  // Mark as enriched
  updateData.apolloEnrichedAt = new Date();

  await prisma.company.update({
    where: { id: companyId },
    data: updateData,
  });
}

// Enrich a single company by domain (used after job import)
export async function enrichCompanyByDomain(
  companyId: string,
  domain: string
): Promise<boolean> {
  try {
    // Check if already enriched
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { apolloEnrichedAt: true, name: true },
    });

    if (!company) return false;
    if (company.apolloEnrichedAt !== null) {
      console.log(`Company ${company.name} already enriched, skipping`);
      return false;
    }

    const apolloData = await fetchCompanyFromApollo(domain);

    if (!apolloData) {
      // No Apollo data - try to generate description with Z.ai
      const aiDescription = await generateCompanyDescriptionWithAI(company.name, domain);

      await prisma.company.update({
        where: { id: companyId },
        data: {
          apolloEnrichedAt: new Date(),
          website: `https://${domain}`,
          ...(aiDescription ? { description: aiDescription } : {}),
        },
      });

      if (aiDescription) {
        console.log(`No Apollo data for ${company.name}, but generated AI description`);
        return true;
      }

      console.log(`No Apollo data for ${company.name}, marked as tried`);
      return false;
    }

    await updateCompanyWithApolloData(companyId, apolloData, domain);

    // If Apollo didn't have a description, generate one with Z.ai
    if (!apolloData.short_description) {
      const aiDescription = await generateCompanyDescriptionWithAI(company.name, domain);
      if (aiDescription) {
        await prisma.company.update({
          where: { id: companyId },
          data: { description: aiDescription },
        });
        console.log(`Enriched company: ${company.name} (Apollo + AI description)`);
        return true;
      }
    }

    console.log(`Enriched company: ${company.name}`);
    return true;
  } catch (error) {
    console.error(`Failed to enrich company ${companyId}:`, error);
    return false;
  }
}

// Queue company for background enrichment (non-blocking)
export function queueCompanyEnrichment(companyId: string, email: string): void {
  // Skip free email providers
  if (isFreeEmail(email)) return;

  const domain = extractDomainFromEmail(email);
  if (!domain) return;

  // Run enrichment in background (don't await)
  enrichCompanyByDomain(companyId, domain).catch(err => {
    console.error(`Background enrichment failed for ${companyId}:`, err);
  });
}

/**
 * Validate company via Apollo and check for logo (Apollo or Logo.dev)
 * Used ONLY for LinkedIn sources to filter fake recruiters
 *
 * Flow:
 * 1. Apollo doesn't know company → REJECT (fake)
 * 2. Apollo knows, has logo → OK
 * 3. Apollo knows, no logo → check Logo.dev with Apollo's website domain
 * 4. Logo.dev has logo → OK
 * 5. No logo anywhere → REJECT
 *
 * @returns true if company is valid and has logo, false if should be rejected
 */
export async function validateAndEnrichCompany(
  companyId: string,
  email: string
): Promise<boolean> {
  const domain = extractDomainFromEmail(email);
  if (!domain) {
    console.log(`[Validation] No domain from email: ${email}`);
    return false;
  }

  try {
    // 1. Check Apollo - this is the PRIMARY validator
    console.log(`[Validation] Checking Apollo for domain: ${domain}`);
    const apolloData = await fetchCompanyFromApollo(domain);

    // If Apollo doesn't know this company - it's likely fake
    if (!apolloData) {
      // Mark as tried
      await prisma.company.update({
        where: { id: companyId },
        data: { apolloEnrichedAt: new Date() },
      });
      console.log(`[Validation] Apollo doesn't know ${domain} - REJECTED as fake company`);
      return false;
    }

    // Apollo knows this company - enrich it (sets apolloEnrichedAt)
    console.log(`[Validation] Apollo found company: ${apolloData.name || domain}`);
    await updateCompanyWithApolloData(companyId, apolloData, domain);

    // 2. Check for logo - Apollo logo is preferred
    if (apolloData.logo_url) {
      console.log(`[Validation] Apollo logo found for ${domain} - APPROVED`);
      return true;
    }

    // 3. No Apollo logo - try Logo.dev with Apollo's website domain
    const websiteDomain = apolloData.website_url
      ? extractDomainFromUrl(apolloData.website_url)
      : domain;

    if (websiteDomain) {
      const hasLogoDevLogo = await validateDomainHasLogo(websiteDomain);
      if (hasLogoDevLogo) {
        console.log(`[Validation] Logo.dev logo found for ${websiteDomain} - APPROVED`);
        return true;
      }
    }

    // 4. Try Logo.dev with email domain (if different from website)
    if (websiteDomain !== domain) {
      const hasLogoDevLogo = await validateDomainHasLogo(domain);
      if (hasLogoDevLogo) {
        console.log(`[Validation] Logo.dev logo found for ${domain} - APPROVED`);
        return true;
      }
    }

    // 5. No logo found anywhere - reject
    console.log(`[Validation] No logo found for ${domain} - REJECTED (no logo)`);
    return false;
  } catch (error) {
    console.error(`[Validation] Error validating company:`, error);
    // On error, be permissive - don't block the job
    return true;
  }
}

// Queue company enrichment by slug/name (for ATS companies without email)
export function queueCompanyEnrichmentBySlug(companyId: string, slug: string): void {
  // Derive domain from slug (e.g., "whoop" -> "whoop.com")
  const domain = `${slug.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

  console.log(`Queueing enrichment for company ${slug} with domain ${domain}`);

  // Run enrichment in background (don't await)
  enrichCompanyByDomain(companyId, domain).catch(err => {
    console.error(`Background enrichment failed for ${companyId}:`, err);
  });
}

// Queue company enrichment by website URL (for Lever companies with real website)
export function queueCompanyEnrichmentByWebsite(companyId: string, websiteUrl: string): void {
  // Extract domain from website URL
  const domain = extractDomainFromUrl(websiteUrl);
  if (!domain) {
    console.log(`Cannot extract domain from website: ${websiteUrl}`);
    return;
  }

  console.log(`Queueing enrichment for company with domain ${domain} (from ${websiteUrl})`);

  // Run enrichment in background (don't await)
  enrichCompanyByDomain(companyId, domain).catch(err => {
    console.error(`Background enrichment failed for ${companyId}:`, err);
  });
}

// Get companies that need enrichment
export async function getCompaniesForEnrichment(limit: number = 50): Promise<Array<{
  id: string;
  name: string;
  email: string;
  domain: string;
}>> {
  const jobs = await prisma.job.findMany({
    where: {
      applyEmail: { not: null },
      company: {
        apolloEnrichedAt: null,
      },
    },
    select: {
      applyEmail: true,
      company: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    distinct: ['companyId'],
    take: limit * 2,
  });

  const companiesMap = new Map<string, { id: string; name: string; email: string; domain: string }>();

  for (const job of jobs) {
    if (!job.applyEmail || !job.company) continue;
    if (isFreeEmail(job.applyEmail)) continue;

    const domain = extractDomainFromEmail(job.applyEmail);
    if (!domain) continue;
    if (companiesMap.has(job.company.id)) continue;

    companiesMap.set(job.company.id, {
      id: job.company.id,
      name: job.company.name,
      email: job.applyEmail,
      domain,
    });

    if (companiesMap.size >= limit) break;
  }

  return Array.from(companiesMap.values());
}

// Main enrichment function (batch)
export async function enrichCompanies(limit: number = 10): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    total: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  const companies = await getCompaniesForEnrichment(limit);
  stats.total = companies.length;

  if (companies.length === 0) {
    console.log('No companies to enrich');
    return stats;
  }

  console.log(`Found ${companies.length} companies to enrich`);

  for (const company of companies) {
    try {
      const apolloData = await fetchCompanyFromApollo(company.domain);

      if (!apolloData) {
        // No Apollo data - try Z.ai description
        const aiDescription = await generateCompanyDescriptionWithAI(company.name, company.domain);

        await prisma.company.update({
          where: { id: company.id },
          data: {
            apolloEnrichedAt: new Date(),
            website: `https://${company.domain}`,
            ...(aiDescription ? { description: aiDescription } : {}),
          },
        });

        if (aiDescription) {
          stats.enriched++;
          console.log(`AI description for: ${company.name} (${company.domain})`);
        } else {
          stats.skipped++;
          console.log(`No Apollo data for: ${company.name} (${company.domain})`);
        }
        continue;
      }

      await updateCompanyWithApolloData(company.id, apolloData, company.domain);

      const hasLogo = !!apolloData.logo_url;
      let hasDescription = !!apolloData.short_description;

      // If Apollo didn't have description, generate with Z.ai
      if (!hasDescription) {
        const aiDescription = await generateCompanyDescriptionWithAI(company.name, company.domain);
        if (aiDescription) {
          await prisma.company.update({
            where: { id: company.id },
            data: { description: aiDescription },
          });
          hasDescription = true;
          console.log(`Added AI description for: ${company.name}`);
        }
      }

      if (hasLogo || hasDescription) {
        stats.enriched++;
        console.log(`Enriched company: ${company.name} (logo: ${hasLogo}, desc: ${hasDescription})`);
      } else {
        stats.skipped++;
        console.log(`Partial data for: ${company.name}`);
      }

      // Rate limiting - be conservative
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      stats.failed++;
      const errorMsg = `${company.name}: ${String(error)}`;
      stats.errors.push(errorMsg);
      console.error(`Failed to enrich ${company.name}:`, error);
    }
  }

  return stats;
}

// Enrich ALL pending companies (for cron/batch processing)
export async function enrichAllPendingCompanies(): Promise<EnrichmentStats> {
  const totalStats: EnrichmentStats = {
    total: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  let hasMore = true;
  const batchSize = 50;

  while (hasMore) {
    const stats = await enrichCompanies(batchSize);

    totalStats.total += stats.total;
    totalStats.enriched += stats.enriched;
    totalStats.skipped += stats.skipped;
    totalStats.failed += stats.failed;
    totalStats.errors.push(...stats.errors);

    // If we got fewer than batch size, we're done
    hasMore = stats.total >= batchSize;

    // Small delay between batches
    if (hasMore) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return totalStats;
}

// Extract domain from URL
function extractDomainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Derive domain from company name (e.g., "Appen" -> "appen.com")
function deriveDomainFromName(name: string): string {
  // Clean company name: remove Inc, LLC, Ltd, Corp, etc.
  const cleaned = name
    .toLowerCase()
    .replace(/[,.]?\s*(inc|llc|ltd|corp|corporation|company|co|gmbh|ag|sa|srl|limited)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  return `${cleaned}.com`;
}

// Enrich companies that don't have email (using website or name)
export async function enrichCompaniesByName(limit: number = 50): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    total: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Find companies that haven't been enriched yet
  const companies = await prisma.company.findMany({
    where: {
      apolloEnrichedAt: null,
    },
    select: {
      id: true,
      name: true,
      website: true,
    },
    take: limit,
  });

  stats.total = companies.length;

  if (companies.length === 0) {
    console.log('No companies to enrich by name');
    return stats;
  }

  console.log(`Found ${companies.length} companies to enrich by name/website`);

  for (const company of companies) {
    try {
      // Try to get domain from website first, then from name
      let domain = extractDomainFromUrl(company.website);

      if (!domain) {
        domain = deriveDomainFromName(company.name);
      }

      console.log(`Trying to enrich ${company.name} with domain: ${domain}`);

      const apolloData = await fetchCompanyFromApollo(domain);

      if (!apolloData) {
        // No Apollo data - try Z.ai description
        const aiDescription = await generateCompanyDescriptionWithAI(company.name, domain);

        await prisma.company.update({
          where: { id: company.id },
          data: {
            apolloEnrichedAt: new Date(),
            ...(aiDescription ? { description: aiDescription } : {}),
          },
        });

        if (aiDescription) {
          stats.enriched++;
          console.log(`AI description for: ${company.name} (${domain})`);
        } else {
          stats.skipped++;
          console.log(`No Apollo data for: ${company.name} (${domain})`);
        }
        continue;
      }

      await updateCompanyWithApolloData(company.id, apolloData, domain);

      const hasLogo = !!apolloData.logo_url;
      let hasDescription = !!apolloData.short_description;

      // If Apollo didn't have description, generate with Z.ai
      if (!hasDescription) {
        const aiDescription = await generateCompanyDescriptionWithAI(company.name, domain);
        if (aiDescription) {
          await prisma.company.update({
            where: { id: company.id },
            data: { description: aiDescription },
          });
          hasDescription = true;
          console.log(`Added AI description for: ${company.name}`);
        }
      }

      if (hasLogo || hasDescription) {
        stats.enriched++;
        console.log(`Enriched company: ${company.name} (logo: ${hasLogo}, desc: ${hasDescription})`);
      } else {
        stats.skipped++;
        console.log(`Partial data for: ${company.name}`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      stats.failed++;
      const errorMsg = `${company.name}: ${String(error)}`;
      stats.errors.push(errorMsg);
      console.error(`Failed to enrich ${company.name}:`, error);
    }
  }

  return stats;
}

// Get enrichment status for admin
export async function getEnrichmentStatus(): Promise<{
  totalCompanies: number;
  enrichedCompanies: number;
  companiesNeedingEnrichment: number;
  companiesWithCorporateEmail: number;
}> {
  const [totalCompanies, enrichedCompanies, companiesNeedingEnrichment] = await Promise.all([
    prisma.company.count(),
    prisma.company.count({
      where: {
        apolloEnrichedAt: { not: null },
        description: { not: null },
      },
    }),
    prisma.company.count({
      where: {
        apolloEnrichedAt: null,
      },
    }),
  ]);

  const jobsWithCorporateEmail = await prisma.job.findMany({
    where: {
      applyEmail: { not: null },
    },
    select: {
      applyEmail: true,
      companyId: true,
    },
    distinct: ['companyId'],
  });

  const companiesWithCorporateEmail = jobsWithCorporateEmail.filter(
    job => job.applyEmail && !isFreeEmail(job.applyEmail)
  ).length;

  return {
    totalCompanies,
    enrichedCompanies,
    companiesNeedingEnrichment,
    companiesWithCorporateEmail,
  };
}
