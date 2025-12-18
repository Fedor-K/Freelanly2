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
  errors?: Array<{ id: string; code: number; details: string }>;
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

// Fetch company data from Hunter API with browser-like headers
async function fetchCompanyFromHunter(domain: string): Promise<HunterCompanyResponse['data'] | null> {
  const apiKey = process.env.HUNTER_API_KEY;

  if (!apiKey) {
    throw new Error('HUNTER_API_KEY environment variable is not set');
  }

  try {
    console.log(`Fetching company data from Hunter for domain: ${domain}`);

    const url = `${HUNTER_API_URL}?domain=${encodeURIComponent(domain)}&api_key=${apiKey}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Hunter API error for ${domain}: ${response.status} - ${errorText.substring(0, 200)}`);

      if (response.status === 404) {
        return null;
      }

      throw new Error(`Hunter API error: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(`Hunter returned non-JSON response: ${text.substring(0, 200)}`);
      throw new Error('Hunter API returned non-JSON response (possibly Cloudflare block)');
    }

    const result: HunterCompanyResponse = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error(`Hunter API errors for ${domain}:`, result.errors);
      return null;
    }

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

  if (data.logo) updateData.logo = data.logo;
  if (data.description) updateData.description = data.description;
  if (data.industry) updateData.industry = data.industry;

  updateData.website = `https://${data.domain || domain}`;

  if (data.linkedin) updateData.linkedinUrl = data.linkedin;

  const headquarters = formatHeadquarters(data);
  if (headquarters) updateData.headquarters = headquarters;

  const size = mapCompanySize(data.headcount);
  if (size) updateData.size = size;

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

      const hasLogo = !!hunterData.logo;
      const hasDescription = !!hunterData.description;

      if (hasLogo || hasDescription) {
        stats.enriched++;
        console.log(`Enriched company: ${company.name} (logo: ${hasLogo}, desc: ${hasDescription})`);
      } else {
        stats.skipped++;
        console.log(`Partial data for: ${company.name}`);
      }

      // Rate limiting
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
