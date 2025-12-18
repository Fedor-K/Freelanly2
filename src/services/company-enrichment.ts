import { prisma } from '@/lib/db';
import { isFreeEmail, extractDomainFromEmail } from '@/lib/utils';

// Hunter API for company enrichment
// https://hunter.io/api-documentation/v2#company
const HUNTER_API_URL = 'https://api.hunter.io/v2/companies/find';

// Response structure from Hunter Company API
interface HunterCompanyResponse {
  data: {
    name?: string;
    domain?: string;
    description?: string;
    industry?: string;
    company_type?: string;
    headcount?: string; // "1-10", "11-50", etc.
    country?: string;
    state?: string;
    city?: string;
    postal_code?: string;
    street?: string;
    logo?: string;
    twitter?: string;
    facebook?: string;
    linkedin?: string;
    instagram?: string;
    youtube?: string;
    technologies?: string[];
  };
  meta?: {
    params?: {
      domain?: string;
    };
  };
}

// Enrichment stats
export interface EnrichmentStats {
  total: number;
  enriched: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// Map Hunter headcount to our company size enum
function mapCompanySize(headcount?: string): 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null {
  if (!headcount) return null;

  // Parse headcount strings like "1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"
  const match = headcount.match(/^(\d+)/);
  if (!match) return null;

  const minEmployees = parseInt(match[1]);

  if (minEmployees <= 10) return 'STARTUP';
  if (minEmployees <= 50) return 'SMALL';
  if (minEmployees <= 200) return 'MEDIUM';
  if (minEmployees <= 1000) return 'LARGE';
  return 'ENTERPRISE';
}

// Format headquarters from Hunter data
function formatHeadquarters(data: HunterCompanyResponse['data']): string | null {
  const parts = [data.city, data.state, data.country].filter(Boolean);
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

// Fetch company data from Hunter API
async function fetchCompanyFromHunter(domain: string): Promise<HunterCompanyResponse['data'] | null> {
  const apiKey = process.env.HUNTER_API_KEY;

  if (!apiKey) {
    throw new Error('HUNTER_API_KEY environment variable is not set');
  }

  try {
    console.log(`Fetching company data from Hunter for domain: ${domain}`);

    const url = `${HUNTER_API_URL}?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Hunter API error for ${domain}: ${response.status} - ${errorText}`);

      if (response.status === 404) {
        // Company not found - not an error, just no data
        return null;
      }

      throw new Error(`Hunter API error: ${response.status}`);
    }

    const result: HunterCompanyResponse = await response.json();

    if (!result.data) {
      console.log(`No data from Hunter for: ${domain}`);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error(`Error fetching from Hunter for ${domain}:`, error);
    throw error;
  }
}

// Update company with enriched data from Hunter
async function updateCompanyWithHunterData(
  companyId: string,
  data: HunterCompanyResponse['data'],
  domain: string
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  // Logo
  if (data.logo) updateData.logo = data.logo;

  // Description
  if (data.description) updateData.description = data.description;

  // Industry
  if (data.industry) updateData.industry = data.industry;

  // Website - use domain
  updateData.website = `https://${data.domain || domain}`;

  // LinkedIn URL
  if (data.linkedin) updateData.linkedinUrl = data.linkedin;

  // Headquarters
  const headquarters = formatHeadquarters(data);
  if (headquarters) updateData.headquarters = headquarters;

  // Company size
  const size = mapCompanySize(data.headcount);
  if (size) updateData.size = size;

  // If no logo found, mark as processed with empty string
  if (!updateData.logo) {
    updateData.logo = '';
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
      const hunterData = await fetchCompanyFromHunter(company.domain);

      if (!hunterData) {
        stats.skipped++;
        // Mark as processed
        await prisma.company.update({
          where: { id: company.id },
          data: {
            logo: '',
            website: `https://${company.domain}`,
          },
        });
        console.log(`No Hunter data for: ${company.name} (${company.domain})`);
        continue;
      }

      await updateCompanyWithHunterData(company.id, hunterData, company.domain);

      // Check if we got useful data
      const hasLogo = !!hunterData.logo;
      const hasDescription = !!hunterData.description;

      if (hasLogo || hasDescription) {
        stats.enriched++;
        console.log(`Enriched company: ${company.name} (logo: ${hasLogo}, desc: ${hasDescription})`);
      } else {
        stats.skipped++;
        console.log(`Partial data for: ${company.name}`);
      }

      // Rate limiting - Hunter has rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
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
