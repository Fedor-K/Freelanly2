import { prisma } from '@/lib/db';
import { isFreeEmail, extractDomainFromEmail } from '@/lib/utils';

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

// Fetch company data from Apollo API
async function fetchCompanyFromApollo(domain: string): Promise<ApolloOrganization | null> {
  const apolloApiKey = process.env.APOLLO_API_KEY;

  if (!apolloApiKey) {
    throw new Error('APOLLO_API_KEY environment variable is not set');
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
