import { prisma } from '../src/lib/db';

async function check() {
  // Check notification timeline
  const notifications = await prisma.alertNotification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      status: true,
      createdAt: true,
      sentAt: true,
      jobId: true,
      opportunityId: true,
    }
  });

  console.log('=== RECENT NOTIFICATIONS TIMELINE ===\n');

  // Group by status and time
  const byStatus: Record<string, number> = {};
  const byHour: Record<string, { pending: number; sent: number }> = {};

  for (const n of notifications) {
    byStatus[n.status] = (byStatus[n.status] || 0) + 1;

    const hour = n.createdAt.toISOString().slice(0, 13);
    if (!byHour[hour]) byHour[hour] = { pending: 0, sent: 0 };
    if (n.status === 'PENDING') byHour[hour].pending++;
    else if (n.status === 'SENT') byHour[hour].sent++;
  }

  console.log('Status counts (last 50):');
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`  ${status}: ${count}`);
  }

  console.log('\nBy hour (created):');
  for (const [hour, counts] of Object.entries(byHour).sort()) {
    console.log(`  ${hour}: pending=${counts.pending}, sent=${counts.sent}`);
  }

  // Check when PENDING notifications were created
  const pending = await prisma.alertNotification.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 5,
    select: {
      createdAt: true,
      job: { select: { title: true } },
      opportunity: { select: { title: true } }
    }
  });

  console.log('\n=== OLDEST PENDING NOTIFICATIONS ===');
  if (pending.length === 0) {
    console.log('No pending notifications - queue is clear!');
  } else {
    for (const p of pending) {
      const title = p.job?.title || p.opportunity?.title;
      console.log(`  Created: ${p.createdAt.toISOString()} - ${title}`);
    }
  }

  // Check last cron execution by looking at sent times
  const lastSent = await prisma.alertNotification.findFirst({
    where: { status: 'SENT', sentAt: { not: null } },
    orderBy: { sentAt: 'desc' },
    select: { sentAt: true }
  });

  console.log('\n=== LAST CRON EXECUTION ===');
  if (lastSent?.sentAt) {
    const ago = Math.round((Date.now() - lastSent.sentAt.getTime()) / 60000);
    console.log(`Last email sent: ${lastSent.sentAt.toISOString()} (${ago} minutes ago)`);
  } else {
    console.log('No sent notifications found');
  }

  // Count notifications created in last hour but not yet sent
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentPending = await prisma.alertNotification.count({
    where: {
      status: 'PENDING',
      createdAt: { gte: hourAgo }
    }
  });

  console.log(`\nPending notifications created in last hour: ${recentPending}`);
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
