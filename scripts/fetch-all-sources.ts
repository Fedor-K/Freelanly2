/**
 * Local script to fetch all sources
 * Run: npx tsx scripts/fetch-all-sources.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
import { processDataSource } from '../src/services/sources';

const prisma = new PrismaClient();
const PARALLEL_TASKS = 10;

async function main() {
  console.log('Starting local source fetch...');

  const stats = {
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
  };

  // Get all active sources
  const sources = await prisma.dataSource.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { lastFetchedAt: 'asc' }, // Oldest first
  });

  console.log(`Found ${sources.length} active sources`);

  // Process in batches
  for (let i = 0; i < sources.length; i += PARALLEL_TASKS) {
    const batch = sources.slice(i, i + PARALLEL_TASKS);
    console.log(`\nBatch ${Math.floor(i / PARALLEL_TASKS) + 1}: ${batch.map(s => s.name).join(', ')}`);

    const results = await Promise.allSettled(
      batch.map(async (source) => {
        try {
          const result = await processDataSource(source.id);
          return { source, success: true, result };
        } catch (error) {
          return { source, success: false, error };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const { source, success, result } = r.value;
        if (success && result) {
          stats.processed++;
          stats.created += result.created;
          stats.skipped += result.skipped;
          console.log(`  ✓ ${source.name}: +${result.created} jobs`);
        } else {
          stats.failed++;
          console.log(`  ✗ ${source.name}: failed`);
        }
      }
    }

    // Progress
    console.log(`Progress: ${Math.min(i + PARALLEL_TASKS, sources.length)}/${sources.length} (${stats.created} jobs created)`);
  }

  console.log('\n=== COMPLETE ===');
  console.log(`Processed: ${stats.processed}`);
  console.log(`Created: ${stats.created}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);

  await prisma.$disconnect();
}

main().catch(console.error);
