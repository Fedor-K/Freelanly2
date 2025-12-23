/**
 * Fix companies without website by extracting domain from job emails
 *
 * This script finds all companies without a website set and tries to
 * derive the website from the applyEmail of their jobs.
 *
 * Usage: npx tsx scripts/fix-company-websites.ts
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

async function main() {
  console.log('Finding companies without website...\n');

  // Find all companies without website
  const companiesWithoutWebsite = await prisma.company.findMany({
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
      website: true,
      jobs: {
        select: {
          applyEmail: true,
        },
        where: {
          applyEmail: { not: null },
        },
        take: 5, // Just need one valid email
      },
    },
  });

  console.log(`Found ${companiesWithoutWebsite.length} companies without website\n`);

  let updated = 0;
  let skipped = 0;
  let noEmail = 0;

  for (const company of companiesWithoutWebsite) {
    // Find first corporate email from jobs
    let domain: string | null = null;

    for (const job of company.jobs) {
      if (job.applyEmail && !isFreeEmail(job.applyEmail)) {
        domain = extractDomainFromEmail(job.applyEmail);
        if (domain) break;
      }
    }

    if (!domain) {
      noEmail++;
      console.log(`⚠️  ${company.name} - no corporate email found`);
      continue;
    }

    const website = `https://${domain}`;

    try {
      await prisma.company.update({
        where: { id: company.id },
        data: { website },
      });
      updated++;
      console.log(`✅ ${company.name} → ${website}`);
    } catch (error) {
      skipped++;
      console.log(`❌ ${company.name} - update failed: ${error}`);
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Updated: ${updated}`);
  console.log(`No email: ${noEmail}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${companiesWithoutWebsite.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
