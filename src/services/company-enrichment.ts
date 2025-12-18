import { prisma } from '@/lib/db';
import { isFreeEmail, extractDomainFromEmail } from '@/lib/utils';

// Hunter.io Company Enrichment API
// https://hunter.io/api-documentation/v2#company-enrichment
const HUNTER_COMPANY_API = 'https://api.hunter.io/v2/companies/find';

// Response structure from Hunter Company Enrichment API
interface HunterCompanyData {
  name?: string;
  legalName?: string;
  domain?: string;
  description?: string;
  logo?: string;
  location?: string;
  category?: {
    sector?: string;
    industryGroup?: string;
    industry?: string;
    subIndustry?: string;
  };
  geo?: {
    city?: string;
    state?: string;
    stateCode?: string;
    country?: string;
    countryCode?: string;
  };
  linkedin?: {
    handle?: string;
  };
  twitter?: {
    handle?: string;
  };
  facebook?: {
    handle?: string;
  };
  metrics?: {
    employees?: string;
  };
  foundedYear?: number;
  type?: string;
  companyType?: string;
}

interface HunterCompanyResponse {
  data: HunterCompanyData;
  meta?: {
    params?: Record<string, string>;
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

// Map company size from Hunter employee range
function mapCompanySize(employees?: string): 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null {
  if (!employees) return null;

  const employeeStr = employees.toLowerCase();

  // Parse ranges like "1-10", "10-50", "50-200", "200-500", "500-1000", "1000-5000", "5K-10K", "10K-50K", etc.
  if (employeeStr.includes('1-10') || employeeStr === '1-10') return 'STARTUP';
  if (employeeStr.includes('10-50') || employeeStr.includes('11-50')) return 'SMALL';
  if (employeeStr.includes('50-200') || employeeStr.includes('51-200')) return 'MEDIUM';
  if (employeeStr.includes('200-500') || employeeStr.includes('201-500')) return 'MEDIUM';
  if (employeeStr.includes('500-1000') || employeeStr.includes('501-1000')) return 'LARGE';
  if (employeeStr.includes('1000-') || employeeStr.includes('1001-') || employeeStr.includes('1k-')) return 'LARGE';
  if (employeeStr.includes('5k') || employeeStr.includes('10k') || employeeStr.includes('50k')) return 'ENTERPRISE';

  // Try to extract first number
  const match = employees.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1]);
    if (num <= 10) return 'STARTUP';
    if (num <= 50) return 'SMALL';
    if (num <= 200) return 'MEDIUM';
    if (num <= 1000) return 'LARGE';
    return 'ENTERPRISE';
  }

  return null;
}

// Format headquarters from Hunter geo data
function formatHeadquarters(geo?: HunterCompanyData['geo'], location?: string): string | null {
  if (geo) {
    const parts = [geo.city, geo.state, geo.country].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }
  // Fall back to location string
  return location || null;
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

// Fetch company data from Hunter Company Enrichment API
async function fetchCompanyFromHunter(domain: string): Promise<HunterCompanyData | null> {
  const hunterApiKey = process.env.HUNTER_API_KEY;

  if (!hunterApiKey) {
    throw new Error('HUNTER_API_KEY environment variable is not set');
  }

  try {
    console.log(`Fetching Hunter Company data for domain: ${domain}`);

    const url = `${HUNTER_COMPANY_API}?domain=${encodeURIComponent(domain)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${hunterApiKey}`,
        'Accept': 'application/json',
        'User-Agent': 'Freelanly/1.0 (Company Enrichment Service)',
      },
    });

    console.log(`Hunter API response status: ${response.status}`);

    if (response.status === 404) {
      console.log(`No Hunter data found for domain: ${domain}`);
      return null;
    }

    if (!response.ok) {
      const text = await response.text();
      console.error(`Hunter API error: ${response.status} - ${text.substring(0, 500)}`);

      // Check if Cloudflare is blocking
      if (text.includes('cloudflare') || text.includes('Cloudflare')) {
        throw new Error(`Cloudflare blocking detected. Status: ${response.status}`);
      }

      throw new Error(`Hunter API error: ${response.status}`);
    }

    const data: HunterCompanyResponse = await response.json();

    if (!data.data) {
      console.log(`Empty data from Hunter for: ${domain}`);
      return null;
    }

    console.log(`Hunter returned data for ${domain}: name=${data.data.name}, logo=${!!data.data.logo}, desc=${!!data.data.description}`);

    return data.data;
  } catch (error) {
    console.error(`Error fetching Hunter data for ${domain}:`, error);
    throw error;
  }
}

// Update company with enriched data from Hunter
async function updateCompanyWithHunterData(
  companyId: string,
  data: HunterCompanyData,
  domain: string
): Promise<void> {
  const updateData: Record<string, unknown> = {};

  if (data.logo) updateData.logo = data.logo;
  if (data.description) updateData.description = data.description;

  // Use industry classification if available
  if (data.category?.industry) {
    updateData.industry = data.category.industry;
  }

  updateData.website = `https://${data.domain || domain}`;

  // LinkedIn URL from handle
  if (data.linkedin?.handle) {
    updateData.linkedinUrl = `https://www.linkedin.com/${data.linkedin.handle}`;
  }

  // Headquarters from geo or location
  const headquarters = formatHeadquarters(data.geo, data.location);
  if (headquarters) updateData.headquarters = headquarters;

  // Company size from employees metric
  const size = mapCompanySize(data.metrics?.employees);
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

      // Rate limiting - Hunter allows 15 req/sec, but let's be conservative
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      stats.failed++;
      const errorMsg = `${company.name}: ${String(error)}`;
      stats.errors.push(errorMsg);
      console.error(`Failed to enrich ${company.name}:`, error);

      // If Cloudflare is blocking, stop processing to avoid wasting requests
      if (String(error).includes('Cloudflare')) {
        console.error('Cloudflare blocking detected - stopping enrichment');
        break;
      }
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
