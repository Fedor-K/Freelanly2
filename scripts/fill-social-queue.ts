import { prisma } from '../src/lib/db';

/**
 * One-time script to fill social queue with existing jobs
 * Run: DATABASE_URL="..." npx tsx scripts/fill-social-queue.ts
 */
async function main() {
  const MAX_AGE_DAYS = 14;
  const LIMIT = 100; // How many jobs to add

  console.log('=== Filling Social Queue ===\n');

  // Get all job IDs already in queue (any status)
  const existingInQueue = await prisma.socialPostQueue.findMany({
    select: { jobId: true }
  });
  const queuedJobIds = new Set(existingInQueue.map(q => q.jobId));
  console.log(`Jobs already in queue: ${queuedJobIds.size}`);

  // Find jobs to add
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - MAX_AGE_DAYS);

  const candidates = await prisma.job.findMany({
    where: {
      locationType: { in: ['REMOTE', 'HYBRID'] },
      applyEmail: { not: null },
      createdAt: { gte: cutoffDate },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, title: true, createdAt: true, company: { select: { name: true } } }
  });

  console.log(`Found ${candidates.length} eligible jobs (last ${MAX_AGE_DAYS} days)\n`);

  let added = 0;
  let skipped = 0;

  for (const job of candidates) {
    if (added >= LIMIT) break;

    if (queuedJobIds.has(job.id)) {
      skipped++;
      continue;
    }

    await prisma.socialPostQueue.create({
      data: {
        jobId: job.id,
        status: 'PENDING',
      }
    });

    console.log(`Added: ${job.title} @ ${job.company.name}`);
    added++;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Added to queue: ${added}`);
  console.log(`Skipped (already in queue): ${skipped}`);

  // Show queue stats
  const stats = await prisma.socialPostQueue.groupBy({
    by: ['status'],
    _count: true
  });

  console.log(`\nQueue stats:`);
  for (const s of stats) {
    console.log(`  ${s.status}: ${s._count}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
