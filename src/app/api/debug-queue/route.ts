/**
 * Debug: check and fix import task queue
 * GET = diagnostics, POST = clear stuck tasks
 * DELETE after use
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const SETUP_KEY = 'fr33lanly-setup-2026';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== SETUP_KEY) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 });
  }

  const fix = req.nextUrl.searchParams.get('fix') === 'true';
  const backfillHours = parseInt(req.nextUrl.searchParams.get('backfill') || '0', 10);

  if (fix) {
    const fixTarget = req.nextUrl.searchParams.get('target') || 'import';
    if (fixTarget === 'alerts-cleanup') {
      // Clean up orphaned AlertNotification records from old queue system
      const deleted = await prisma.alertNotification.deleteMany({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      });
      return NextResponse.json({
        action: 'alerts-cleanup',
        deleted: deleted.count,
        message: 'Orphaned AlertNotification records from old queue system deleted.',
      });
    }
    const deleted = await prisma.importTask.deleteMany({});
    return NextResponse.json({
      action: 'cleared',
      deleted: deleted.count,
      message: 'All import tasks deleted. Next fetch-sources cron will create fresh tasks.',
    });
  }

  if (backfillHours > 0) {
    // Backfill is no longer needed — pull-model cron automatically picks up
    // opportunities based on lastSentAt. To force re-send, reset lastSentAt on alerts.
    return NextResponse.json({
      action: 'backfill',
      message: 'Backfill is deprecated. Pull-model cron handles alert delivery based on lastSentAt.',
    });
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const [
    importPending, importProcessing, importStuck,
    instantAlerts, totalEmailsSent,
    alertsSentToday, alertsSentWeek, lastAlertSent,
    orphanedPending,
    oppsToday, oppsWeek,
  ] = await Promise.all([
    prisma.importTask.count({ where: { status: 'PENDING' } }),
    prisma.importTask.count({ where: { status: 'PROCESSING' } }),
    prisma.importTask.count({ where: { status: 'PENDING', retryCount: { gte: 3 } } }),
    prisma.jobAlert.count({ where: { isActive: true, frequency: 'INSTANT' } }),
    prisma.jobAlert.aggregate({ where: { isActive: true, frequency: 'INSTANT' }, _sum: { emailsSent: true } }),
    // Pull-model metrics: count alerts with lastSentAt today/this week
    prisma.jobAlert.count({ where: { isActive: true, frequency: 'INSTANT', lastSentAt: { gte: new Date(now - day) } } }),
    prisma.jobAlert.count({ where: { isActive: true, frequency: 'INSTANT', lastSentAt: { gte: new Date(now - 7 * day) } } }),
    prisma.jobAlert.findFirst({ where: { isActive: true, frequency: 'INSTANT', lastSentAt: { not: null } }, orderBy: { lastSentAt: 'desc' }, select: { lastSentAt: true, email: true } }),
    // Orphaned records from old queue system
    prisma.alertNotification.count({ where: { status: { in: ['PENDING', 'PROCESSING'] } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: new Date(now - day) } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: new Date(now - 7 * day) } } }),
  ]);

  return NextResponse.json({
    importQueue: { pending: importPending, processing: importProcessing, stuck: importStuck },
    alerts: {
      instantAlerts,
      totalEmailsSent: totalEmailsSent._sum.emailsSent || 0,
      alertsSentToday,
      alertsSentWeek,
      lastSentAt: lastAlertSent?.lastSentAt,
      lastSentTo: lastAlertSent?.email,
      orphanedNotifications: orphanedPending,
    },
    content: { oppsToday, oppsWeek },
  });
}
