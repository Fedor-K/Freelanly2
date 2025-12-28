/**
 * Delete jobs that don't match whitelist filter
 */

import { prisma } from '../src/lib/db';
import { shouldImportByProfession } from '../src/config/target-professions';

async function main() {
  console.log('=== Deleting jobs that fail whitelist filter ===\n');

  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      company: {
        select: {
          name: true,
        },
      },
    },
  });

  const toDelete: string[] = [];

  for (const job of jobs) {
    if (!shouldImportByProfession(job.title)) {
      toDelete.push(job.id);
    }
  }

  console.log(`Found ${toDelete.length} jobs to delete\n`);

  if (toDelete.length === 0) {
    console.log('Nothing to delete.');
    return;
  }

  // Delete in batches
  const batchSize = 50;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = toDelete.slice(i, i + batchSize);

    await prisma.job.deleteMany({
      where: {
        id: { in: batch },
      },
    });

    deleted += batch.length;
    console.log(`Deleted ${deleted}/${toDelete.length} jobs...`);
  }

  console.log(`\n✅ Successfully deleted ${deleted} jobs`);

  // Show remaining count
  const remaining = await prisma.job.count();
  console.log(`\nRemaining jobs in database: ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
