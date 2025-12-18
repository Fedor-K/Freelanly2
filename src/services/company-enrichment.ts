import { prisma } from '@/lib/db';
import { ApifyClient } from 'apify-client';
import { isFreeEmail, extractDomainFromEmail } from '@/lib/utils';

// Apify Hunter.io Actor
// https://apify.com/canadesk/hunter-io
const HUNTER_APIFY_ACTOR = 'canadesk/hunter-io';

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

// Response structure from Hunter via Apify
interface HunterApifyResult {
  domain?: string;
  company?: string;
  description?: string;
  industry?: string;
  size?: string;
  country?: string;
  state?: string;
  city?: string;
  logo?: string;
  linkedin?: string;
  twitter?: string;
  facebook?: string;
  emails?: Array<{
    value?: string;
    type?: string;
    first_name?: string;
    last_name?: string;
    position?: string;
  }>;
}

// Enrichment stats
export interface EnrichmentStats {
  total: number;
  enriched: number;
  skipped: number;
  failed: number;
  errors: string[];
}

// Map company size
function mapCompanySize(size?: string): 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null {
  if (!size) return null;

  const match = size.match(/^(\d+)/);
  if (!match) return null;

  const minEmployees = parseInt(match[1]);

  if (minEmployees <= 10) return 'STARTUP';
  if (minEmployees <= 50) return 'SMALL';
  if (minEmployees <= 200) return 'MEDIUM';
  if (minEmployees <= 1000) return 'LARGE';
  return 'ENTERPRISE';
}

// Format headquarters
function formatHeadquarters(data: HunterApifyResult): string | null {
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

// Fetch company data from Hunter via Apify
async function fetchCompanyFromHunterApify(domain: string): Promise<HunterApifyResult | null> {
  const apify = getApifyClient();
  const hunterApiKey = process.env.HUNTER_API_KEY;

  if (!hunterApiKey) {
    throw new Error('HUNTER_API_KEY environment variable is not set');
  }

  try {
    console.log(`Fetching Hunter data via Apify for domain: ${domain}`);

    const run = await apify.actor(HUNTER_APIFY_ACTOR).call(
      {
        apiKey: hunterApiKey,
        domain: domain,
        type: 'domain-search',
      },
      {
        timeout: 120,
      }
    );

    const { items } = await apify.dataset(run.defaultDatasetId).listItems();

    if (items.length === 0) {
      console.log(`No Hunter data for: ${domain}`);
      return null;
    }

    return items[0] as HunterApifyResult;
  } catch (error) {
    console.error(`Error fetching Hunter data for ${domain}:`, error);
    throw error;
  }
}

// Update company with enriched data
async function updateCompanyWithHunterData(
  companyId: string,
  data: HunterApifyResult,
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

  const size = mapCompanySize(data.size);
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
      const hunterData = await fetchCompanyFromHunterApify(company.domain);

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
