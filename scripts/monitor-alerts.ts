#!/usr/bin/env npx tsx
/**
 * Job Alerts Monitoring Script
 *
 * Usage:
 *   npx tsx scripts/monitor-alerts.ts
 *   npx tsx scripts/monitor-alerts.ts --detailed
 *   npx tsx scripts/monitor-alerts.ts --fix-stuck
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function color(text: string, c: keyof typeof COLORS): string {
  return `${COLORS[c]}${text}${COLORS.reset}`;
}

function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
}

function formatRelative(date: Date): string {
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

async function getQueueStatus() {
  console.log(color('\n═══ ALERT QUEUE STATUS ═══', 'bright'));

  const counts = await prisma.alertNotification.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  const statusMap: Record<string, number> = {};
  for (const c of counts) {
    statusMap[c.status] = c._count.id;
  }

  const pending = statusMap['PENDING'] || 0;
  const processing = statusMap['PROCESSING'] || 0;
  const sent = statusMap['SENT'] || 0;

  console.log(`  PENDING:    ${pending > 0 ? color(String(pending), 'yellow') : color('0', 'green')}`);
  console.log(`  PROCESSING: ${processing > 0 ? color(String(processing), 'red') : color('0', 'green')} ${processing > 0 ? '⚠️  (may be stuck!)' : ''}`);
  console.log(`  SENT:       ${color(String(sent), 'gray')}`);

  // Check for stuck PROCESSING (older than 10 min)
  if (processing > 0) {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stuck = await prisma.alertNotification.count({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: tenMinAgo },
      },
    });
    if (stuck > 0) {
      console.log(color(`  ⚠️  ${stuck} notifications stuck in PROCESSING > 10 min`, 'red'));
    }
  }

  return { pending, processing, sent };
}

async function getTodayStats() {
  console.log(color('\n═══ TODAY\'S STATISTICS ═══', 'bright'));

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Notifications created today
  const createdToday = await prisma.alertNotification.count({
    where: { createdAt: { gte: todayStart } },
  });

  // Notifications sent today
  const sentToday = await prisma.alertNotification.count({
    where: {
      status: 'SENT',
      sentAt: { gte: todayStart },
    },
  });

  // Unique emails sent to today
  const uniqueEmailsToday = await prisma.alertNotification.findMany({
    where: {
      status: 'SENT',
      sentAt: { gte: todayStart },
    },
    select: {
      jobAlert: {
        select: { email: true },
      },
    },
    distinct: ['jobAlertId'],
  });

  // Jobs created today
  const jobsToday = await prisma.job.count({
    where: { createdAt: { gte: todayStart } },
  });

  // Opportunities created today
  const oppsToday = await prisma.opportunity.count({
    where: { createdAt: { gte: todayStart } },
  });

  console.log(`  Notifications queued:  ${createdToday}`);
  console.log(`  Notifications sent:    ${sentToday}`);
  console.log(`  Unique users emailed:  ${uniqueEmailsToday.length}`);
  console.log(`  Jobs imported:         ${jobsToday}`);
  console.log(`  Opportunities created: ${oppsToday}`);
}

async function getRecentKeywordRuns() {
  console.log(color('\n═══ RECENT n8n KEYWORD RUNS ═══', 'bright'));

  const runs = await prisma.keywordRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 10,
  });

  if (runs.length === 0) {
    console.log(color('  No keyword runs found', 'gray'));
    return;
  }

  console.log('  Keyword              Status     Recv  Proc  Created  Started');
  console.log('  ' + '─'.repeat(70));

  for (const run of runs) {
    const keyword = run.keyword.slice(0, 18).padEnd(18);
    const status = run.status.padEnd(10);
    const recv = String(run.postsReceived).padStart(4);
    const proc = String(run.postsProcessed).padStart(4);
    const created = String(run.opportunitiesCreated).padStart(7);
    const started = formatRelative(run.startedAt);

    const statusColor = run.status === 'COMPLETED' ? 'green' :
                        run.status === 'STARTED' ? 'yellow' : 'red';

    console.log(`  ${keyword}  ${color(status, statusColor)}  ${recv}  ${proc}  ${created}  ${started}`);
  }
}

async function getRecentOpportunities() {
  console.log(color('\n═══ RECENT OPPORTUNITIES (n8n) ═══', 'bright'));

  const opps = await prisma.opportunity.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      title: true,
      clientName: true,
      contentQuality: true,
      sourceKeyword: true,
      createdAt: true,
    },
  });

  if (opps.length === 0) {
    console.log(color('  No opportunities found', 'gray'));
    return;
  }

  console.log('  Title                          Client              Quality  Keyword       Created');
  console.log('  ' + '─'.repeat(90));

  for (const opp of opps) {
    const title = opp.title.slice(0, 28).padEnd(28);
    const client = (opp.clientName || 'Unknown').slice(0, 18).padEnd(18);
    const quality = (opp.contentQuality || 'N/A').padEnd(7);
    const keyword = (opp.sourceKeyword || '-').slice(0, 12).padEnd(12);
    const created = formatRelative(opp.createdAt);

    const qualityColor = opp.contentQuality === 'RICH' ? 'green' :
                         opp.contentQuality === 'LIGHT' ? 'yellow' : 'gray';

    console.log(`  ${title}  ${client}  ${color(quality, qualityColor)}  ${keyword}  ${created}`);
  }
}

async function getRecentNotifications(detailed: boolean) {
  console.log(color('\n═══ RECENT SENT NOTIFICATIONS ═══', 'bright'));

  const notifications = await prisma.alertNotification.findMany({
    where: { status: 'SENT' },
    orderBy: { sentAt: 'desc' },
    take: detailed ? 20 : 10,
    include: {
      jobAlert: {
        select: {
          email: true,
          category: true,
        },
      },
      job: {
        select: { title: true },
      },
      opportunity: {
        select: { title: true },
      },
    },
  });

  if (notifications.length === 0) {
    console.log(color('  No sent notifications found', 'gray'));
    return;
  }

  console.log('  Email                         Category      Item                           Sent');
  console.log('  ' + '─'.repeat(90));

  for (const n of notifications) {
    const email = (n.jobAlert.email || 'unknown').slice(0, 28).padEnd(28);
    const category = (n.jobAlert.category || 'all').slice(0, 12).padEnd(12);
    const item = (n.job?.title || n.opportunity?.title || 'deleted').slice(0, 30).padEnd(30);
    const sent = n.sentAt ? formatRelative(n.sentAt) : 'N/A';

    const itemType = n.job ? color('J', 'blue') : color('O', 'cyan');

    console.log(`  ${email}  ${category}  ${itemType} ${item}  ${sent}`);
  }
}

async function getAlertStats() {
  console.log(color('\n═══ ALERT CONFIGURATION ═══', 'bright'));

  // Total alerts
  const totalAlerts = await prisma.jobAlert.count();
  const activeAlerts = await prisma.jobAlert.count({
    where: { isActive: true },
  });

  // Alerts by category
  const byCategory = await prisma.jobAlert.groupBy({
    by: ['category'],
    where: { isActive: true },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  // Alerts with language pairs (translation users)
  const withLangPairs = await prisma.jobAlert.count({
    where: {
      isActive: true,
      languagePairs: { some: {} },
    },
  });

  // Users with verified email
  const verifiedUsers = await prisma.user.count({
    where: { emailVerified: { not: null } },
  });

  console.log(`  Total alerts:     ${totalAlerts}`);
  console.log(`  Active alerts:    ${color(String(activeAlerts), 'green')}`);
  console.log(`  With lang pairs:  ${withLangPairs}`);
  console.log(`  Verified users:   ${verifiedUsers}`);

  console.log(color('\n  Top categories:', 'gray'));
  for (const cat of byCategory.slice(0, 5)) {
    console.log(`    ${(cat.category || 'all').padEnd(15)} ${cat._count.id} alerts`);
  }
}

async function getDebounceStatus() {
  console.log(color('\n═══ DEBOUNCE STATUS ═══', 'bright'));

  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

  // Alerts sent in last 30 min (would be debounced)
  const recentlySent = await prisma.jobAlert.count({
    where: {
      isActive: true,
      lastSentAt: { gte: thirtyMinAgo },
    },
  });

  // Alerts at daily limit (3+ emails today)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // This is approximate - checking alerts with 3+ sent today
  const alertsWithManySent = await prisma.alertNotification.groupBy({
    by: ['jobAlertId'],
    where: {
      status: 'SENT',
      sentAt: { gte: todayStart },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: 3 } },
    },
  });

  console.log(`  Debounced (sent < 30m ago):  ${recentlySent}`);
  console.log(`  At daily limit (3+ today):   ${alertsWithManySent.length}`);
}

async function fixStuckNotifications() {
  console.log(color('\n═══ FIXING STUCK NOTIFICATIONS ═══', 'bright'));

  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);

  const result = await prisma.alertNotification.updateMany({
    where: {
      status: 'PROCESSING',
      updatedAt: { lt: tenMinAgo },
    },
    data: {
      status: 'PENDING',
    },
  });

  if (result.count > 0) {
    console.log(color(`  ✓ Reset ${result.count} stuck notifications to PENDING`, 'green'));
  } else {
    console.log(color('  No stuck notifications found', 'gray'));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const detailed = args.includes('--detailed') || args.includes('-d');
  const fixStuck = args.includes('--fix-stuck') || args.includes('-f');

  console.log(color('╔════════════════════════════════════════════════════════════╗', 'cyan'));
  console.log(color('║           FREELANLY JOB ALERTS MONITOR                     ║', 'cyan'));
  console.log(color('║           ' + formatDate(new Date()) + '                        ║', 'cyan'));
  console.log(color('╚════════════════════════════════════════════════════════════╝', 'cyan'));

  await getQueueStatus();
  await getTodayStats();
  await getDebounceStatus();
  await getAlertStats();
  await getRecentKeywordRuns();
  await getRecentOpportunities();
  await getRecentNotifications(detailed);

  if (fixStuck) {
    await fixStuckNotifications();
  }

  console.log(color('\n═══ END OF REPORT ═══\n', 'bright'));
}

main()
  .catch((e) => {
    console.error(color('Error:', 'red'), e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
