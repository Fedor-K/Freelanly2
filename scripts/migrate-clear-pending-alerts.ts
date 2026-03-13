/**
 * Migration: Clear all PENDING AlertNotification records
 *
 * After switching to pull-model for INSTANT alerts, the PENDING queue is no longer used.
 * This script marks all PENDING and PROCESSING records as SENT (without sending emails)
 * to clean up the 2.3M+ stale records.
 *
 * Usage: npx tsx scripts/migrate-clear-pending-alerts.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Clearing PENDING/PROCESSING AlertNotifications ===\n');

  // Get counts before migration
  const [pendingCount, processingCount, totalCount] = await Promise.all([
    prisma.alertNotification.count({ where: { status: 'PENDING' } }),
    prisma.alertNotification.count({ where: { status: 'PROCESSING' } }),
    prisma.alertNotification.count(),
  ]);

  console.log(`Total AlertNotification records: ${totalCount}`);
  console.log(`PENDING: ${pendingCount}`);
  console.log(`PROCESSING: ${processingCount}`);
  console.log(`Records to update: ${pendingCount + processingCount}\n`);

  if (pendingCount + processingCount === 0) {
    console.log('Nothing to migrate. All records are already SENT.');
    return;
  }

  // Update in batches to avoid timeout
  const BATCH_SIZE = 10000;
  let totalUpdated = 0;

  // Mark PROCESSING first (smaller set)
  if (processingCount > 0) {
    const result = await prisma.alertNotification.updateMany({
      where: { status: 'PROCESSING' },
      data: { status: 'SENT', sentAt: new Date() },
    });
    totalUpdated += result.count;
    console.log(`Marked ${result.count} PROCESSING → SENT`);
  }

  // Mark PENDING in batches
  let batchNum = 0;
  while (true) {
    batchNum++;
    const batch = await prisma.alertNotification.findMany({
      where: { status: 'PENDING' },
      select: { id: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    const result = await prisma.alertNotification.updateMany({
      where: { id: { in: batch.map((b) => b.id) } },
      data: { status: 'SENT', sentAt: new Date() },
    });

    totalUpdated += result.count;
    console.log(`Batch ${batchNum}: ${result.count} PENDING → SENT (total: ${totalUpdated})`);
  }

  console.log(`\n=== Migration complete: ${totalUpdated} records marked as SENT ===`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
