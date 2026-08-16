/**
 * Fix Lever companies without website by deriving domain from slug/atsId
 *
 * Lever company slugs typically match their domain:
 * - "whoop" → https://whoop.com
 * - "anthropic" → https://anthropic.com
 *
 * Usage: npx tsx scripts/fix-lever-company-websites.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Finding Lever companies without website...\n');

  // Find all Lever companies (atsType = LEVER) without website
  const leverCompanies = await prisma.company.findMany({
    where: {
      atsType: 'LEVER',
      OR: [
        { website: null },
        { website: '' },
      ],
    },
    select: {
      id: true,
      name: true,
      slug: true,
      atsId: true,
      website: true,
    },
  });

  console.log(`Found ${leverCompanies.length} Lever companies without website\n`);

  let updated = 0;
  let skipped = 0;

  for (const company of leverCompanies) {
    // Derive website from atsId (Lever slug) or company slug
    const leverSlug = company.atsId || company.slug;
    const domain = leverSlug.toLowerCase().replace(/[^a-z0-9]/g, '');
    const website = `https://${domain}.com`;

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
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${leverCompanies.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
