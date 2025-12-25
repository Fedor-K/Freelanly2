/**
 * Migration script: Add AI-generated cleanDescription to existing Lever jobs
 *
 * This script processes all Lever jobs that don't have a cleanDescription
 * through DeepSeek AI to generate structured, SEO-friendly descriptions.
 *
 * Usage:
 *   npx tsx scripts/migrate-lever-descriptions.ts
 *   npx tsx scripts/migrate-lever-descriptions.ts --dry-run
 *   npx tsx scripts/migrate-lever-descriptions.ts --limit 10
 */

import { prisma } from '../src/lib/db';
import { extractJobData } from '../src/lib/deepseek';

const BATCH_SIZE = 5; // Process 5 jobs at a time to avoid rate limits
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

interface MigrationStats {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
  estimatedCost: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function migrateLeverDescriptions(options: {
  dryRun?: boolean;
  limit?: number;
}): Promise<MigrationStats> {
  const stats: MigrationStats = {
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    estimatedCost: 0,
  };

  console.log('🔍 Finding Lever jobs without cleanDescription...\n');

  // Find all Lever jobs without cleanDescription
  const jobs = await prisma.job.findMany({
    where: {
      source: 'LEVER',
      cleanDescription: null,
    },
    select: {
      id: true,
      title: true,
      description: true,
      company: {
        select: { name: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit,
  });

  stats.total = jobs.length;
  console.log(`📊 Found ${stats.total} Lever jobs to process\n`);

  if (stats.total === 0) {
    console.log('✅ All Lever jobs already have cleanDescription!');
    return stats;
  }

  if (options.dryRun) {
    console.log('🔸 DRY RUN MODE - No changes will be made\n');
    console.log('Jobs that would be processed:');
    for (const job of jobs) {
      console.log(`  - ${job.title} at ${job.company.name}`);
    }
    console.log(`\n💰 Estimated cost: ~$${(stats.total * 0.002).toFixed(3)}`);
    return stats;
  }

  // Process in batches
  const batches = [];
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE));
  }

  console.log(`📦 Processing ${batches.length} batches of ${BATCH_SIZE} jobs each...\n`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`\n📦 Batch ${batchIndex + 1}/${batches.length}`);

    for (const job of batch) {
      stats.processed++;
      const progress = `[${stats.processed}/${stats.total}]`;

      if (!job.description) {
        console.log(`${progress} ⏭️  Skipping "${job.title}" - no description`);
        stats.skipped++;
        continue;
      }

      try {
        console.log(`${progress} 🔄 Processing: ${job.title}`);

        // Call DeepSeek API
        const aiData = await extractJobData(job.description);

        if (!aiData?.cleanDescription) {
          console.log(`${progress} ⚠️  No cleanDescription generated`);
          stats.skipped++;
          continue;
        }

        // Update job in database
        await prisma.job.update({
          where: { id: job.id },
          data: {
            cleanDescription: aiData.cleanDescription,
            summaryBullets: aiData.summaryBullets || [],
            requirementBullets: aiData.requirementBullets || [],
            benefitBullets: aiData.benefitBullets || [],
            // Also update benefits if extracted
            benefits: aiData.benefits?.length ? aiData.benefits : undefined,
          },
        });

        stats.success++;
        stats.estimatedCost += 0.002; // ~$0.002 per job
        console.log(`${progress} ✅ Updated: ${job.title}`);

      } catch (error) {
        stats.failed++;
        const errorMsg = `${job.title}: ${error}`;
        stats.errors.push(errorMsg);
        console.log(`${progress} ❌ Failed: ${job.title}`);
        console.error(`   Error: ${error}`);
      }

      // Small delay between individual jobs
      await sleep(300);
    }

    // Delay between batches
    if (batchIndex < batches.length - 1) {
      console.log(`\n⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1], 10) : undefined;

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Lever Jobs Migration: Add AI-generated cleanDescription  ');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (dryRun) {
    console.log('Mode: DRY RUN (no changes)\n');
  }

  if (limit) {
    console.log(`Limit: ${limit} jobs\n`);
  }

  try {
    const stats = await migrateLeverDescriptions({ dryRun, limit });

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('                    MIGRATION COMPLETE                      ');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`\n📊 Results:`);
    console.log(`   Total jobs found:  ${stats.total}`);
    console.log(`   Processed:         ${stats.processed}`);
    console.log(`   ✅ Success:        ${stats.success}`);
    console.log(`   ⏭️  Skipped:        ${stats.skipped}`);
    console.log(`   ❌ Failed:         ${stats.failed}`);
    console.log(`   💰 Estimated cost: ~$${stats.estimatedCost.toFixed(3)}`);

    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      for (const error of stats.errors.slice(0, 10)) {
        console.log(`   - ${error}`);
      }
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more`);
      }
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
