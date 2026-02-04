import { prisma } from '@/lib/db';
import { isFreeEmail, extractDomainFromEmail } from '@/lib/utils';
import { validateDomainHasLogo } from '@/lib/company-logo';
import OpenAI from 'openai';

// Z.ai client for AI-generated descriptions
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
 * Generate company description using Z.ai
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

// Enrichment stats
export interface EnrichmentStats {
  total: number;
  enriched: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// Enrich a single company by domain (used after job import)
export async function enrichCompanyByDomain(
  companyId: string,
  domain: string
): Promise<boolean> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { apolloEnrichedAt: true, description: true, name: true, website: true },
    });

    if (!company) return false;

    // Skip if already has description
    if (company.description) {
      console.log(`Company ${company.name} already has description, skipping`);
      return false;
    }

    const aiDescription = await generateCompanyDescriptionWithAI(company.name, domain);

    await prisma.company.update({
      where: { id: companyId },
      data: {
        apolloEnrichedAt: new Date(),
        ...(!company.website ? { website: `https://${domain}` } : {}),
        ...(aiDescription ? { description: aiDescription } : {}),
      },
    });

    if (aiDescription) {
      console.log(`[Z.ai] Enriched company: ${company.name}`);
      return true;
    }

    console.log(`[Z.ai] Failed to generate description for ${company.name}`);
    return false;
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
 * Validate company via Logo.dev and enrich with Z.ai description
 * Used ONLY for LinkedIn sources to filter fake recruiters
 *
 * Flow:
 * 1. Check Logo.dev for company logo → if found, APPROVE
 * 2. No logo → REJECT
 * 3. Generate Z.ai description in background
 *
 * @returns true if company has logo, false if should be rejected
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
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { name: true, description: true },
    });
    const companyName = company?.name || domain;

    // 1. Check Logo.dev for logo
    const hasLogo = await validateDomainHasLogo(domain);

    if (!hasLogo) {
      console.log(`[Validation] No logo found for ${domain} - REJECTED`);
      await prisma.company.update({
        where: { id: companyId },
        data: { apolloEnrichedAt: new Date() },
      });
      return false;
    }

    console.log(`[Validation] Logo found for ${domain} - APPROVED`);

    // 2. Generate Z.ai description if missing (background, don't block)
    if (!company?.description) {
      generateCompanyDescriptionWithAI(companyName, domain).then(async (aiDescription) => {
        if (aiDescription) {
          await prisma.company.update({
            where: { id: companyId },
            data: { description: aiDescription, apolloEnrichedAt: new Date() },
          });
          console.log(`[Validation] Z.ai generated description for ${companyName}`);
        }
      }).catch(err => {
        console.error(`[Validation] Z.ai description failed for ${companyName}:`, err);
      });
    }

    return true;
  } catch (error) {
    console.error(`[Validation] Error validating company:`, error);
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

// Main enrichment function (batch) — Z.ai only
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
        console.log(`[Z.ai] Description for: ${company.name} (${company.domain})`);
      } else {
        stats.skipped++;
        console.log(`[Z.ai] No description for: ${company.name} (${company.domain})`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
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

// Enrich companies that don't have email (using website or name) — Z.ai only
export async function enrichCompaniesByName(limit: number = 50): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    total: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Find companies without description
  const companies = await prisma.company.findMany({
    where: {
      description: null,
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
      let domain = extractDomainFromUrl(company.website);

      if (!domain) {
        domain = deriveDomainFromName(company.name);
      }

      console.log(`[Z.ai] Enriching ${company.name} with domain: ${domain}`);

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
        console.log(`[Z.ai] Description for: ${company.name} (${domain})`);
      } else {
        stats.skipped++;
        console.log(`[Z.ai] No description for: ${company.name} (${domain})`);
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
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
