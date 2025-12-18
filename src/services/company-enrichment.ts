import { prisma } from '@/lib/db';
import { ApifyClient } from 'apify-client';
import { isFreeEmail, extractDomainFromEmail } from '@/lib/utils';

// LinkedIn Company Scraper Actor ID
// https://apify.com/logical_scrapers/linkedin-company-scraper
const LINKEDIN_COMPANY_ACTOR = 'logical_scrapers/linkedin-company-scraper';

// Lazy initialization
let _apify: ApifyClient | null = null;

function getApifyClient(): ApifyClient {
  if (!_apify) {
    _apify = new ApifyClient({
      token: process.env.APIFY_API_TOKEN || 'dummy-token-for-build',
    });
  }
  return _apify;
}

// Response structure from LinkedIn Company Scraper
interface LinkedInCompanyData {
  name?: string;
  universalName?: string;
  linkedinUrl?: string;
  description?: string;
  website?: string;
  industry?: string;
  companySize?: {
    start?: number;
    end?: number;
  };
  employeeCount?: number;
  headquarter?: {
    city?: string;
    country?: string;
    geographicArea?: string;
    postalCode?: string;
    line1?: string;
    line2?: string;
  };
  foundedOn?: {
    year?: number;
  };
  specialities?: string[];
  logo?: string;
  backgroundCover?: string;
  followerCount?: number;
  staffCount?: number;
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
function mapCompanySize(employeeCount?: number): 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null {
  if (!employeeCount) return null;
  if (employeeCount <= 10) return 'STARTUP';
  if (employeeCount <= 50) return 'SMALL';
  if (employeeCount <= 200) return 'MEDIUM';
  if (employeeCount <= 1000) return 'LARGE';
  return 'ENTERPRISE';
}

// Format headquarters from LinkedIn data
function formatHeadquarters(headquarter?: LinkedInCompanyData['headquarter']): string | null {
  if (!headquarter) return null;
  const parts = [headquarter.city, headquarter.geographicArea, headquarter.country].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : null;
}

// Get companies that need enrichment
export async function getCompaniesForEnrichment(limit: number = 50): Promise<Array<{
  id: string;
  name: string;
  email: string;
  domain: string;
}>> {
  // Find jobs with corporate emails (not free providers)
  const jobs = await prisma.job.findMany({
    where: {
      applyEmail: { not: null },
      company: {
        logo: null, // Not yet enriched
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
    take: limit * 2, // Get more to account for filtering
  });

  const companiesMap = new Map<string, { id: string; name: string; email: string; domain: string }>();

  for (const job of jobs) {
    if (!job.applyEmail || !job.company) continue;

    // Skip free email providers
    if (isFreeEmail(job.applyEmail)) continue;

    const domain = extractDomainFromEmail(job.applyEmail);
    if (!domain) continue;

    // Skip if already in map
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

// Enrich a single company using LinkedIn
async function enrichCompanyFromLinkedIn(
  companyName: string,
  domain?: string
): Promise<LinkedInCompanyData | null> {
  const apify = getApifyClient();

  try {
    // Search by company name
    const input = {
      queries: [companyName],
      maxResults: 1,
    };

    console.log(`Enriching company: ${companyName}`);

    const run = await apify.actor(LINKEDIN_COMPANY_ACTOR).call(input, {
      timeout: 120, // 2 minutes timeout
    });

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();

    if (items.length === 0) {
      console.log(`No LinkedIn data found for: ${companyName}`);
      return null;
    }

    return items[0] as LinkedInCompanyData;
  } catch (error) {
    console.error(`Error enriching company ${companyName}:`, error);
    throw error;
  }
}

// Update company with enriched data
async function updateCompanyWithEnrichedData(
  companyId: string,
  data: LinkedInCompanyData
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (data.logo) updateData.logo = data.logo;
  if (data.description) updateData.description = data.description;
  if (data.industry) updateData.industry = data.industry;
  if (data.website) updateData.website = data.website;
  if (data.linkedinUrl) updateData.linkedinUrl = data.linkedinUrl;
  if (data.foundedOn?.year) updateData.foundedYear = data.foundedOn.year;

  const headquarters = formatHeadquarters(data.headquarter);
  if (headquarters) updateData.headquarters = headquarters;

  const employeeCount = data.employeeCount || data.staffCount || data.companySize?.end;
  const size = mapCompanySize(employeeCount);
  if (size) updateData.size = size;

  if (Object.keys(updateData).length > 0) {
    await prisma.company.update({
      where: { id: companyId },
      data: updateData,
    });
  }
}

// Main enrichment function
export async function enrichCompanies(limit: number = 10): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    total: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Get companies to enrich
  const companies = await getCompaniesForEnrichment(limit);
  stats.total = companies.length;

  if (companies.length === 0) {
    console.log('No companies to enrich');
    return stats;
  }

  console.log(`Found ${companies.length} companies to enrich`);

  for (const company of companies) {
    try {
      const linkedInData = await enrichCompanyFromLinkedIn(company.name, company.domain);

      if (!linkedInData) {
        stats.skipped++;
        // Mark as processed (set empty logo to prevent re-processing)
        await prisma.company.update({
          where: { id: company.id },
          data: { logo: '' },
        });
        continue;
      }

      await updateCompanyWithEnrichedData(company.id, linkedInData);
      stats.enriched++;
      console.log(`Enriched company: ${company.name}`);

      // Rate limiting - delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      stats.failed++;
      stats.errors.push(`${company.name}: ${String(error)}`);
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
  const [totalCompanies, enrichedCompanies, companiesWithLogo] = await Promise.all([
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

  // Count companies with corporate email (rough estimate)
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
    companiesNeedingEnrichment: companiesWithLogo,
    companiesWithCorporateEmail,
  };
}
