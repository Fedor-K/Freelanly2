/**
 * Bulk add Lever ATS sources
 *
 * Usage: npx tsx scripts/add-lever-sources.ts
 *
 * Edit COMPANIES array below with your list of company slugs
 */

import { prisma } from '../src/lib/db';

// Add your companies here (one per line or comma-separated)
const COMPANIES = `
jobgether,
cwsc,
xsolla,
bighealth,
livefront,
tom-steyer,
tapasmedia,
plivo,
simonmed,
corebts,
sofarsounds
`.split(/[,\n]/).map(s => s.trim().toLowerCase()).filter(Boolean);

async function validateLeverCompany(slug: string): Promise<{ valid: boolean; jobCount?: number; error?: string }> {
  try {
    const response = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`);
    if (!response.ok) {
      return { valid: false, error: `HTTP ${response.status}` };
    }
    const jobs = await response.json();
    if (!Array.isArray(jobs)) {
      return { valid: false, error: 'Invalid response' };
    }
    return { valid: true, jobCount: jobs.length };
  } catch (error) {
    return { valid: false, error: String(error) };
  }
}

async function main() {
  console.log('=== Adding Lever Sources ===\n');
  console.log(`Companies to add: ${COMPANIES.length}\n`);

  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const slug of COMPANIES) {
    console.log(`\n[${slug}]`);

    // Check if already exists
    const existing = await prisma.dataSource.findFirst({
      where: {
        sourceType: 'LEVER',
        companySlug: slug,
      },
    });

    if (existing) {
      console.log(`  -> SKIP: already exists`);
      skipped++;
      continue;
    }

    // Validate
    console.log(`  -> Validating...`);
    const validation = await validateLeverCompany(slug);

    if (!validation.valid) {
      console.log(`  -> FAILED: ${validation.error}`);
      failed++;
      continue;
    }

    console.log(`  -> Found ${validation.jobCount} jobs`);

    // Add source
    await prisma.dataSource.create({
      data: {
        name: slug,
        sourceType: 'LEVER',
        companySlug: slug,
        isActive: true,
      },
    });

    console.log(`  -> ADDED`);
    added++;

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log('\n=== Summary ===');
  console.log(`Added: ${added}`);
  console.log(`Skipped (existing): ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
