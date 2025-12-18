import { prisma } from '@/lib/db';
import { ApifyClient } from 'apify-client';
import { isFreeEmail, extractDomainFromEmail } from '@/lib/utils';

// LinkedIn Companies Search Scraper (No Login Required)
// https://apify.com/apimaestro/linkedin-companies-search-scraper
// $5 per 1000 results - searches by keyword, no cookies needed
const LINKEDIN_COMPANY_SEARCH_ACTOR = 'apimaestro/linkedin-companies-search-scraper';

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

// Response structure from LinkedIn Companies Search Scraper
interface LinkedInCompanySearchResult {
  name?: string;
  universalName?: string;
  linkedinUrl?: string;
  url?: string;
  description?: string;
  tagline?: string;
  website?: string;
  industry?: string;
  industryCode?: string;
  companySize?: string;
  employeeCount?: number;
  employeeCountRange?: {
    start?: number;
    end?: number;
  };
  headquarter?: {
    city?: string;
    country?: string;
    geographicArea?: string;
    postalCode?: string;
    line1?: string;
  };
  locations?: Array<{
    city?: string;
    country?: string;
  }>;
  foundedOn?: number;
  foundedYear?: number;
  specialities?: string[];
  logo?: string;
  logoUrl?: string;
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

// Map company size from employee count or range
function mapCompanySize(data: LinkedInCompanySearchResult): 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null {
  const count = data.employeeCount || data.staffCount || data.employeeCountRange?.end;
  if (!count) {
    // Try to parse from companySize string like "11-50" or "1001-5000"
    if (data.companySize) {
      const match = data.companySize.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num <= 10) return 'STARTUP';
        if (num <= 50) return 'SMALL';
        if (num <= 200) return 'MEDIUM';
        if (num <= 1000) return 'LARGE';
        return 'ENTERPRISE';
      }
    }
    return null;
  }
  if (count <= 10) return 'STARTUP';
  if (count <= 50) return 'SMALL';
  if (count <= 200) return 'MEDIUM';
  if (count <= 1000) return 'LARGE';
  return 'ENTERPRISE';
}

// Format headquarters from LinkedIn data
function formatHeadquarters(data: LinkedInCompanySearchResult): string | null {
  if (data.headquarter) {
    const parts = [data.headquarter.city, data.headquarter.geographicArea, data.headquarter.country].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  if (data.locations && data.locations.length > 0) {
    const loc = data.locations[0];
    const parts = [loc.city, loc.country].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  return null;
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

// Search for company on LinkedIn by name
async function searchCompanyOnLinkedIn(companyName: string): Promise<LinkedInCompanySearchResult | null> {
  const apify = getApifyClient();

  try {
    console.log(`Searching LinkedIn for company: ${companyName}`);

    const run = await apify.actor(LINKEDIN_COMPANY_SEARCH_ACTOR).call(
      {
        keywords: companyName,
        maxResults: 1,
      },
      {
        timeout: 120, // 2 minutes timeout
      }
    );

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();

    if (items.length === 0) {
      console.log(`No LinkedIn results for: ${companyName}`);
      return null;
    }

    return items[0] as LinkedInCompanySearchResult;
  } catch (error) {
    console.error(`Error searching LinkedIn for ${companyName}:`, error);
    throw error;
  }
}

// Update company with enriched data
async function updateCompanyWithEnrichedData(
  companyId: string,
  data: LinkedInCompanySearchResult,
  domain: string
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  // Logo - try multiple fields
  const logo = data.logo || data.logoUrl;
  if (logo) updateData.logo = logo;

  // Description - try tagline if no description
  const description = data.description || data.tagline;
  if (description) updateData.description = description;

  // Industry
  if (data.industry) updateData.industry = data.industry;

  // Website - use from LinkedIn or construct from domain
  if (data.website) {
    updateData.website = data.website;
  } else if (domain) {
    updateData.website = `https://${domain}`;
  }

  // LinkedIn URL
  const linkedinUrl = data.linkedinUrl || data.url;
  if (linkedinUrl) updateData.linkedinUrl = linkedinUrl;

  // Founded year
  const foundedYear = data.foundedYear || data.foundedOn;
  if (foundedYear) updateData.foundedYear = foundedYear;

  // Headquarters
  const headquarters = formatHeadquarters(data);
  if (headquarters) updateData.headquarters = headquarters;

  // Company size
  const size = mapCompanySize(data);
  if (size) updateData.size = size;

  // Always update something to mark as processed
  if (!updateData.logo) {
    updateData.logo = ''; // Mark as processed but no logo found
  }

  await prisma.company.update({
    where: { id: companyId },
    data: updateData,
  });
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
      const linkedInData = await searchCompanyOnLinkedIn(company.name);

      if (!linkedInData) {
        stats.skipped++;
        // Mark as processed
        await prisma.company.update({
          where: { id: company.id },
          data: {
            logo: '',
            website: `https://${company.domain}`,
          },
        });
        continue;
      }

      await updateCompanyWithEnrichedData(company.id, linkedInData, company.domain);

      // Check if we actually got useful data
      const hasLogo = linkedInData.logo || linkedInData.logoUrl;
      const hasDescription = linkedInData.description || linkedInData.tagline;

      if (hasLogo || hasDescription) {
        stats.enriched++;
        console.log(`Enriched company: ${company.name} (logo: ${!!hasLogo}, desc: ${!!hasDescription})`);
      } else {
        stats.skipped++;
        console.log(`No useful data for: ${company.name}`);
      }

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

  // Count companies with corporate email
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
