/**
 * Re-enrich companies with missing description
 *
 * Usage: DATABASE_URL="..." APOLLO_API_KEY1="..." npx tsx scripts/enrich-empty-companies.ts [limit]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const APOLLO_API = 'https://api.apollo.io/api/v1/organizations/enrich';

interface ApolloOrganization {
  name?: string;
  website_url?: string;
  logo_url?: string;
  short_description?: string;
  industry?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
  estimated_num_employees?: number;
}

function extractDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // Skip non-company domains
    if (hostname.includes('lever.co') || hostname.includes('bit.ly') || hostname.includes('linkedin.com')) {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}

function mapCompanySize(employees?: number): 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE' | 'ENTERPRISE' | null {
  if (!employees) return null;
  if (employees <= 10) return 'STARTUP';
  if (employees <= 50) return 'SMALL';
  if (employees <= 200) return 'MEDIUM';
  if (employees <= 1000) return 'LARGE';
  return 'ENTERPRISE';
}

async function fetchFromApollo(domain: string): Promise<ApolloOrganization | null> {
  const apiKey = process.env.APOLLO_API_KEY1;
  if (!apiKey) {
    throw new Error('APOLLO_API_KEY1 not set');
  }

  const response = await fetch(`${APOLLO_API}?domain=${encodeURIComponent(domain)}`, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Apollo API error: ${response.status}`);
  }

  const data = await response.json();
  return data.organization || null;
}

async function main() {
  const limit = parseInt(process.argv[2] || '50', 10);

  console.log(`\n=== Enriching companies without description (limit: ${limit}) ===\n`);

  // Find companies with empty description that have a website
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { description: null },
        { description: '' }
      ],
      website: { not: null }
    },
    orderBy: { createdAt: 'desc' },
    take: limit
  });

  console.log(`Found ${companies.length} companies to enrich\n`);

  const stats = { total: companies.length, enriched: 0, skipped: 0, failed: 0 };

  for (const company of companies) {
    const domain = extractDomain(company.website || '');

    if (!domain) {
      console.log(`SKIP ${company.name}: no valid domain from ${company.website}`);
      stats.skipped++;
      continue;
    }

    try {
      console.log(`Fetching: ${company.name} (${domain})...`);

      const org = await fetchFromApollo(domain);

      if (!org || !org.short_description) {
        console.log(`  -> No description from Apollo`);
        stats.skipped++;
        continue;
      }

      // Build update data
      const updateData: Record<string, unknown> = {
        description: org.short_description,
      };

      // Update other fields if they're empty
      if (org.logo_url && !company.logo) {
        updateData.logo = org.logo_url;
      }
      if (org.industry && !company.industry) {
        updateData.industry = org.industry;
      }
      if (org.linkedin_url && !company.linkedinUrl) {
        updateData.linkedinUrl = org.linkedin_url;
      }
      if (org.website_url) {
        updateData.website = org.website_url;
      }

      const headquarters = [org.city, org.state, org.country].filter(Boolean).join(', ');
      if (headquarters && !company.headquarters) {
        updateData.headquarters = headquarters;
      }

      const size = mapCompanySize(org.estimated_num_employees);
      if (size && !company.size) {
        updateData.size = size;
      }

      // Update name if Apollo has a proper one and current is just slug
      if (org.name && company.name === company.slug) {
        updateData.name = org.name;
      }

      await prisma.company.update({
        where: { id: company.id },
        data: updateData
      });

      console.log(`  -> Updated: ${org.short_description.slice(0, 60)}...`);
      stats.enriched++;

      // Rate limit: 100ms delay between requests
      await new Promise(r => setTimeout(r, 100));

    } catch (error) {
      console.log(`  -> ERROR: ${error}`);
      stats.failed++;
    }
  }

  console.log('\n=== Results ===');
  console.log(`Total: ${stats.total}`);
  console.log(`Enriched: ${stats.enriched}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
