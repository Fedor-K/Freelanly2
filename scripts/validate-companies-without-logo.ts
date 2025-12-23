/**
 * Validate all companies without logo through Apollo + Logo.dev flow
 *
 * Flow for each company:
 * 1. Get email domain from company's jobs
 * 2. Check Apollo - if unknown → DELETE company and jobs
 * 3. Check logo (Apollo or Logo.dev) - if no logo → DELETE company and jobs
 * 4. If valid → keep and update with enrichment data
 */

import { prisma } from '../src/lib/db';
import { extractDomainFromEmail } from '../src/lib/utils';
import { validateDomainHasLogo } from '../src/lib/company-logo';

// Apollo.io API
const APOLLO_API = 'https://api.apollo.io/api/v1/organizations/enrich';

interface ApolloOrganization {
  id?: string;
  name?: string;
  website_url?: string;
  logo_url?: string;
  short_description?: string;
  industry?: string;
  estimated_num_employees?: number;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
}

async function fetchCompanyFromApollo(domain: string): Promise<ApolloOrganization | null> {
  const apolloApiKey = process.env.APOLLO_API_KEY;

  if (!apolloApiKey) {
    console.error('APOLLO_API_KEY not set!');
    return null;
  }

  try {
    const url = `${APOLLO_API}?domain=${encodeURIComponent(domain)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': apolloApiKey,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      console.error(`Apollo API error: ${response.status}`);
      return null;
    }

    const data = await response.json();
    return data.organization || null;
  } catch (error) {
    console.error(`Error fetching Apollo data for ${domain}:`, error);
    return null;
  }
}

function extractDomainFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function main() {
  console.log('=== Validating companies without logo ===\n');

  // Find companies without logo
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { logo: null },
        { logo: '' },
      ],
    },
    include: {
      jobs: {
        select: {
          id: true,
          applyEmail: true,
          title: true,
        },
        take: 1, // We just need one email
      },
    },
  });

  console.log(`Found ${companies.length} companies without logo\n`);

  let validated = 0;
  let deleted = 0;
  let noEmail = 0;
  let errors = 0;

  for (const company of companies) {
    console.log(`\n--- Processing: ${company.name} (${company.slug}) ---`);

    // Get email domain from jobs
    const jobWithEmail = company.jobs.find(j => j.applyEmail);
    if (!jobWithEmail?.applyEmail) {
      console.log(`  ⚠️ No email found, skipping`);
      noEmail++;
      continue;
    }

    const domain = extractDomainFromEmail(jobWithEmail.applyEmail);
    if (!domain) {
      console.log(`  ⚠️ Could not extract domain from: ${jobWithEmail.applyEmail}`);
      noEmail++;
      continue;
    }

    console.log(`  📧 Domain: ${domain}`);

    try {
      // 1. Check Apollo
      console.log(`  🔍 Checking Apollo...`);
      const apolloData = await fetchCompanyFromApollo(domain);

      if (!apolloData) {
        console.log(`  ❌ Apollo doesn't know this company - DELETING`);

        // Delete all jobs first
        const deletedJobs = await prisma.job.deleteMany({
          where: { companyId: company.id },
        });
        console.log(`     Deleted ${deletedJobs.count} jobs`);

        // Delete company
        await prisma.company.delete({ where: { id: company.id } });
        console.log(`     Deleted company`);

        deleted++;
        continue;
      }

      console.log(`  ✓ Apollo found: ${apolloData.name || domain}`);

      // 2. Check for logo
      let hasLogo = false;

      // Check Apollo logo
      if (apolloData.logo_url) {
        console.log(`  ✓ Apollo has logo`);
        hasLogo = true;
      } else {
        // Try Logo.dev with Apollo's website domain
        const websiteDomain = apolloData.website_url
          ? extractDomainFromUrl(apolloData.website_url)
          : domain;

        if (websiteDomain) {
          console.log(`  🔍 Checking Logo.dev for ${websiteDomain}...`);
          const hasLogoDevLogo = await validateDomainHasLogo(websiteDomain);
          if (hasLogoDevLogo) {
            console.log(`  ✓ Logo.dev has logo`);
            hasLogo = true;
          }
        }

        // Try email domain if different
        if (!hasLogo && websiteDomain !== domain) {
          console.log(`  🔍 Checking Logo.dev for ${domain}...`);
          const hasLogoDevLogo = await validateDomainHasLogo(domain);
          if (hasLogoDevLogo) {
            console.log(`  ✓ Logo.dev has logo for email domain`);
            hasLogo = true;
          }
        }
      }

      if (!hasLogo) {
        console.log(`  ❌ No logo found anywhere - DELETING`);

        // Delete all jobs first
        const deletedJobs = await prisma.job.deleteMany({
          where: { companyId: company.id },
        });
        console.log(`     Deleted ${deletedJobs.count} jobs`);

        // Delete company
        await prisma.company.delete({ where: { id: company.id } });
        console.log(`     Deleted company`);

        deleted++;
        continue;
      }

      // 3. Update company with Apollo data
      console.log(`  ✅ VALID - Updating with Apollo data`);

      await prisma.company.update({
        where: { id: company.id },
        data: {
          name: apolloData.name || company.name,
          logo: apolloData.logo_url || '',
          description: apolloData.short_description || company.description,
          industry: apolloData.industry || company.industry,
          website: apolloData.website_url || company.website || `https://${domain}`,
          linkedinUrl: apolloData.linkedin_url || company.linkedinUrl,
          headquarters: [apolloData.city, apolloData.state, apolloData.country]
            .filter(Boolean)
            .join(', ') || company.headquarters,
        },
      });

      validated++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));

    } catch (error) {
      console.error(`  ⚠️ Error processing: ${error}`);
      errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total companies processed: ${companies.length}`);
  console.log(`Validated (kept): ${validated}`);
  console.log(`Deleted: ${deleted}`);
  console.log(`No email (skipped): ${noEmail}`);
  console.log(`Errors: ${errors}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
