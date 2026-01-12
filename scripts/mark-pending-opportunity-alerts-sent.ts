/**
 * One-time script to mark all PENDING opportunity notifications as SENT
 * This prevents old queued notifications from being sent after we fix the bug
 *
 * Run: npx tsx scripts/mark-pending-opportunity-alerts-sent.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Marking pending opportunity notifications as SENT...');

  // Find all PENDING notifications that are for opportunities (not jobs)
  const pendingOpportunityAlerts = await prisma.alertNotification.findMany({
    where: {
      status: 'PENDING',
      opportunityId: { not: null },
      jobId: null,
    },
    select: {
      id: true,
      opportunityId: true,
    },
  });

  console.log(`Found ${pendingOpportunityAlerts.length} pending opportunity notifications`);

  if (pendingOpportunityAlerts.length === 0) {
    console.log('No pending opportunity notifications to update');
    return;
  }

  // Mark them all as SENT
  const result = await prisma.alertNotification.updateMany({
    where: {
      id: { in: pendingOpportunityAlerts.map((n) => n.id) },
    },
    data: {
      status: 'SENT',
      sentAt: new Date(),
    },
  });

  console.log(`Marked ${result.count} opportunity notifications as SENT`);
  console.log('Done! These old notifications will not be sent.');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
