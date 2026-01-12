import { prisma } from '../src/lib/db';

async function check() {
  // Get notifications from the last 24 hours
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const notifications = await prisma.alertNotification.findMany({
    where: {
      createdAt: { gte: dayAgo }
    },
    orderBy: { createdAt: 'asc' },
    select: {
      status: true,
      createdAt: true,
      sentAt: true,
    }
  });

  console.log('=== NOTIFICATIONS IN LAST 24 HOURS ===');
  console.log('Total:', notifications.length);

  // Group by hour
  const byHour: Record<string, { created: number; sent: number; avgDelay: number[] }> = {};

  for (const n of notifications) {
    const createdHour = n.createdAt.toISOString().slice(0, 13);
    if (!byHour[createdHour]) byHour[createdHour] = { created: 0, sent: 0, avgDelay: [] };
    byHour[createdHour].created++;

    if (n.status === 'SENT' && n.sentAt) {
      byHour[createdHour].sent++;
      const delay = (n.sentAt.getTime() - n.createdAt.getTime()) / 60000; // minutes
      byHour[createdHour].avgDelay.push(delay);
    }
  }

  console.log('\nBy hour (created time):');
  console.log('Hour                | Created | Sent | Avg Delay (min)');
  console.log('-'.repeat(55));

  for (const [hour, data] of Object.entries(byHour).sort()) {
    const avgDelay = data.avgDelay.length > 0
      ? Math.round(data.avgDelay.reduce((a, b) => a + b, 0) / data.avgDelay.length)
      : '-';
    console.log(`${hour}:00 | ${String(data.created).padStart(7)} | ${String(data.sent).padStart(4)} | ${avgDelay}`);
  }

  // Check for any notifications that took a long time to send
  const longDelay = notifications.filter(n => {
    if (n.status !== 'SENT' || !n.sentAt) return false;
    const delay = (n.sentAt.getTime() - n.createdAt.getTime()) / 60000;
    return delay > 30; // more than 30 minutes
  });

  if (longDelay.length > 0) {
    console.log('\n=== NOTIFICATIONS WITH >30 MIN DELAY ===');
    console.log('Count:', longDelay.length);

    // Show a few examples
    for (const n of longDelay.slice(0, 5)) {
      const delay = Math.round((n.sentAt!.getTime() - n.createdAt.getTime()) / 60000);
      console.log(`  Created: ${n.createdAt.toISOString()}, Sent: ${n.sentAt!.toISOString()}, Delay: ${delay} min`);
    }
  }
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
