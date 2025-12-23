import { prisma } from '@/lib/db';
import { isFreeEmail, extractDomainFromEmail, slugify } from '@/lib/utils';
import { validateDomainHasLogo } from '@/lib/company-logo';

// Apollo.io Organization Enrichment API
const APOLLO_API = 'https://api.apollo.io/api/v1/organizations/enrich';

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
  const apolloApiKey = process.env.APOLLO_API_KEY;

  if (!apolloApiKey) {
    console.warn('APOLLO_API_KEY not set, skipping enrichment');
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

  // Mark as processed even if no logo found
  if (!updateData.logo) {
    updateData.logo = '';
  }

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
      select: { logo: true, name: true },
    });

    if (!company) return false;
    if (company.logo !== null) {
      console.log(`Company ${company.name} already processed, skipping`);
      return false;
    }

    const apolloData = await fetchCompanyFromApollo(domain);

    if (!apolloData) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          logo: '',
          website: `https://${domain}`,
        },
      });
      return false;
    }

    await updateCompanyWithApolloData(companyId, apolloData, domain);
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
 * Enrich company and validate that it has a logo (from Apollo or Logo.dev)
 * This is a SYNCHRONOUS check used to filter out fake companies
 *
 * @returns true if company has a valid logo, false if should be rejected
 */
export async function enrichAndValidateCompanyLogo(
  companyId: string,
  email: string
): Promise<boolean> {
  const domain = extractDomainFromEmail(email);
  if (!domain) return false;

  try {
    // 1. Try Apollo enrichment
    const apolloData = await fetchCompanyFromApollo(domain);

    if (apolloData) {
      // Update company with Apollo data
      await updateCompanyWithApolloData(companyId, apolloData, domain);

      // If Apollo returned a logo, we're good
      if (apolloData.logo_url) {
        console.log(`[Enrichment] Apollo logo found for ${domain}`);
        return true;
      }

      // If Apollo returned a website, try Logo.dev with that domain
      if (apolloData.website_url) {
        const websiteDomain = extractDomainFromUrl(apolloData.website_url);
        if (websiteDomain && websiteDomain !== domain) {
          const hasLogoDevLogo = await validateDomainHasLogo(websiteDomain);
          if (hasLogoDevLogo) {
            console.log(`[Enrichment] Logo.dev logo found for ${websiteDomain} (Apollo website)`);
            return true;
          }
        }
      }
    }

    // 2. Try Logo.dev with email domain directly
    const hasLogoDevLogo = await validateDomainHasLogo(domain);
    if (hasLogoDevLogo) {
      console.log(`[Enrichment] Logo.dev logo found for ${domain}`);
      // Update company website if not set
      await prisma.company.update({
        where: { id: companyId },
        data: { website: `https://${domain}`, logo: '' },
      });
      return true;
    }

    // 3. No logo found anywhere
    console.log(`[Enrichment] No logo found for ${domain} - company will be rejected`);
    return false;
  } catch (error) {
    console.error(`[Enrichment] Error validating company ${companyId}:`, error);
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
        logo: null,
      },
    },
    select: {
      applyEmail: true,
      company: {
        select: {
          id: true,
          name: true,
          logo: true,
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
        stats.skipped++;
        await prisma.company.update({
          where: { id: company.id },
          data: {
            logo: '',
            website: `https://${company.domain}`,
          },
        });
        console.log(`No Apollo data for: ${company.name} (${company.domain})`);
        continue;
      }

      await updateCompanyWithApolloData(company.id, apolloData, company.domain);

      const hasLogo = !!apolloData.logo_url;
      const hasDescription = !!apolloData.short_description;

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

  // Find companies without logo that don't have jobs with corporate email
  const companies = await prisma.company.findMany({
    where: {
      logo: null,
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
        stats.skipped++;
        await prisma.company.update({
          where: { id: company.id },
          data: { logo: '' }, // Mark as processed
        });
        console.log(`No Apollo data for: ${company.name} (${domain})`);
        continue;
      }

      await updateCompanyWithApolloData(company.id, apolloData, domain);

      const hasLogo = !!apolloData.logo_url;
      const hasDescription = !!apolloData.short_description;

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
        logo: { not: null },
        NOT: { logo: '' },
      },
    }),
    prisma.company.count({
      where: {
        logo: null,
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
