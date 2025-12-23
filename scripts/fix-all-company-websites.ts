/**
 * Fix ALL companies without website
 *
 * Priority for deriving website:
 * 1. Lever companies: use atsId/slug (e.g., "whoop" → "whoop.com")
 * 2. LinkedIn companies: use job email domain (e.g., "@stripe.com" → "stripe.com")
 * 3. Other companies: derive from company name (e.g., "Stripe" → "stripe.com")
 *
 * Usage: npx tsx scripts/fix-all-company-websites.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Free email providers that shouldn't be used for company websites
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com',
  'mail.com', 'yandex.com', 'zoho.com', 'yandex.ru', 'mail.ru',
]);

function extractDomainFromEmail(email: string | null): string | null {
  if (!email) return null;
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}

function isFreeEmail(email: string): boolean {
  const domain = extractDomainFromEmail(email);
  return domain ? FREE_EMAIL_PROVIDERS.has(domain) : true;
}

// Derive domain from company name/slug
function deriveDomainFromName(name: string): string {
  // Clean company name: remove Inc, LLC, Ltd, Corp, etc.
  const cleaned = name
    .toLowerCase()
    .replace(/[,.]?\s*(inc|llc|ltd|corp|corporation|company|co|gmbh|ag|sa|srl|limited|pvt|private)\.?$/i, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  return `${cleaned}.com`;
}

async function main() {
  console.log('Finding all companies without website...\n');

  // Find all companies without website
  const companies = await prisma.company.findMany({
    where: {
      OR: [
        { website: null },
        { website: '' },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      atsType: true,
      atsId: true,
      website: true,
      jobs: {
        select: {
          applyEmail: true,
        },
        where: {
          applyEmail: { not: null },
        },
        take: 5,
      },
    },
  });

  console.log(`Found ${companies.length} companies without website\n`);

  let updated = 0;
  let skipped = 0;
  const bySource: Record<string, number> = {};

  for (const company of companies) {
    let website: string | null = null;
    let source = 'name';

    // 1. Lever companies: use atsId or slug
    if (company.atsType === 'LEVER') {
      const leverSlug = company.atsId || company.slug;
      const domain = leverSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
      website = `https://${domain}.com`;
      source = 'lever';
    }

    // 2. Try to get domain from job emails
    if (!website || website === 'https://.com') {
      for (const job of company.jobs) {
        if (job.applyEmail && !isFreeEmail(job.applyEmail)) {
          const domain = extractDomainFromEmail(job.applyEmail);
          if (domain) {
            website = `https://${domain}`;
            source = 'email';
            break;
          }
        }
      }
    }

    // 3. Derive from company name as last resort
    if (!website || website === 'https://.com') {
      const domain = deriveDomainFromName(company.name);
      if (domain && domain !== '.com') {
        website = `https://${domain}`;
        source = 'name';
      }
    }

    if (!website || website === 'https://.com' || website === 'https://') {
      skipped++;
      console.log(`⚠️  ${company.name} - could not derive website`);
      continue;
    }

    try {
      await prisma.company.update({
        where: { id: company.id },
        data: { website },
      });
      updated++;
      bySource[source] = (bySource[source] || 0) + 1;
      console.log(`✅ ${company.name} → ${website} (${source})`);
    } catch (error) {
      skipped++;
      console.log(`❌ ${company.name} - update failed: ${error}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${companies.length}`);
  console.log('\nBy source:');
  for (const [source, count] of Object.entries(bySource)) {
    console.log(`  ${source}: ${count}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
