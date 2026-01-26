#!/usr/bin/env npx tsx
/**
 * Check alerts with high email counts for potential spam issues
 *
 * Usage: npx tsx scripts/check-alert-spam.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║           ALERT SPAM CHECK                                ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Find alerts with high email counts
  const alerts = await prisma.jobAlert.findMany({
    where: { emailsSent: { gte: 50 } },
    orderBy: { emailsSent: 'desc' },
    take: 20,
    include: {
      user: { select: { email: true, createdAt: true } },
      languagePairs: true,
      _count: { select: { alertNotifications: true } },
    },
  });

  if (alerts.length === 0) {
    console.log('Нет алертов с 50+ отправками');
    return;
  }

  console.log(`Найдено ${alerts.length} алертов с 50+ отправками:\n`);

  for (const alert of alerts) {
    const email = alert.email || alert.user?.email || 'unknown';
    const createdAt = alert.createdAt;
    const daysSinceCreated = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const expectedMax = daysSinceCreated * 3; // 3 emails per day max
    const isSpam = alert.emailsSent > expectedMax * 1.5; // 50% tolerance

    console.log('═'.repeat(60));
    console.log(`Email:      ${email}`);
    console.log(`Category:   ${alert.category || 'all'}`);
    console.log(`Languages:  ${alert.languagePairs.map(p => `${p.sourceLanguage}→${p.targetLanguage}`).join(', ') || 'none'}`);
    console.log(`Created:    ${createdAt.toISOString().slice(0, 10)} (${daysSinceCreated} days ago)`);
    console.log(`Emails:     ${alert.emailsSent}`);
    console.log(`Expected:   max ${expectedMax} (${daysSinceCreated} days × 3/day)`);
    console.log(`Status:     ${isSpam ? '🚨 SPAM! Превышен лимит' : '✅ OK'}`);
    console.log(`Last sent:  ${alert.lastSentAt?.toISOString().slice(0, 16) || 'never'}`);

    // Check notification timeline
    const recentNotifications = await prisma.alertNotification.findMany({
      where: { jobAlertId: alert.id, status: 'SENT' },
      orderBy: { sentAt: 'desc' },
      take: 10,
      select: { sentAt: true },
    });

    if (recentNotifications.length > 0) {
      console.log(`\nПоследние 10 отправок:`);
      recentNotifications.forEach((n, i) => {
        console.log(`  ${i + 1}. ${n.sentAt?.toISOString().slice(0, 16) || 'N/A'}`);
      });
    }

    // Check for same-day spam
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await prisma.alertNotification.count({
      where: {
        jobAlertId: alert.id,
        status: 'SENT',
        sentAt: { gte: todayStart },
      },
    });
    console.log(`\nСегодня отправлено: ${todayCount} (лимит: 3)`);

    if (todayCount > 3) {
      console.log('🚨 ПРЕВЫШЕН ДНЕВНОЙ ЛИМИТ!');
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('КОНЕЦ ПРОВЕРКИ');
}

check()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
