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
    const deleted = await prisma.importTask.deleteMany({});
    return NextResponse.json({
      action: 'cleared',
      deleted: deleted.count,
      message: 'All import tasks deleted. Next fetch-sources cron will create fresh tasks.',
    });
  }

  if (backfillHours > 0) {
    const { queueInstantAlertsForOpportunity } = await import('@/services/alert-notifications');
    const recentOpps = await prisma.opportunity.findMany({
      where: { createdAt: { gte: new Date(Date.now() - backfillHours * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
      take: 20,
    });

    let totalQueued = 0;
    for (const opp of recentOpps) {
      try {
        const result = await queueInstantAlertsForOpportunity(opp.id);
        totalQueued += result.queued;
      } catch { /* skip */ }
    }
    return NextResponse.json({
      action: 'backfill',
      oppsProcessed: recentOpps.length,
      notificationsQueued: totalQueued,
    });
  }

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  const [
    importPending, importProcessing, importStuck,
    instantAlerts,
    notifPending, notifPendingInstant, notifFailed, notifFailedToday, notifSentToday, notifSentWeek,
    lastSent,
    jobsToday, oppsToday, oppsWeek,
  ] = await Promise.all([
    prisma.importTask.count({ where: { status: 'PENDING' } }),
    prisma.importTask.count({ where: { status: 'PROCESSING' } }),
    prisma.importTask.count({ where: { status: 'PENDING', retryCount: { gte: 3 } } }),
    prisma.jobAlert.count({ where: { isActive: true, frequency: 'INSTANT' } }),
    prisma.alertNotification.count({ where: { status: 'PENDING' } }),
    prisma.alertNotification.count({ where: { status: 'PENDING', jobAlert: { frequency: 'INSTANT', isActive: true } } }),
    prisma.alertNotification.count({ where: { status: 'PROCESSING' } }),
    prisma.alertNotification.count({ where: { status: 'PROCESSING', createdAt: { gte: new Date(now - day) } } }),
    prisma.alertNotification.count({ where: { status: 'SENT', sentAt: { gte: new Date(now - day) } } }),
    prisma.alertNotification.count({ where: { status: 'SENT', sentAt: { gte: new Date(now - 7 * day) } } }),
    prisma.alertNotification.findFirst({ where: { status: 'SENT' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
    prisma.job.count({ where: { createdAt: { gte: new Date(now - day) } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: new Date(now - day) } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: new Date(now - 7 * day) } } }),
  ]);

  return NextResponse.json({
    importQueue: { pending: importPending, processing: importProcessing, stuck: importStuck },
    alerts: {
      instantAlerts,
      pending: notifPending,
      pendingInstant: notifPendingInstant,
      processing: notifFailed,
      processingToday: notifFailedToday,
      sentToday: notifSentToday,
      sentWeek: notifSentWeek,
      lastSentAt: lastSent?.sentAt,
    },
    content: { jobsToday, oppsToday, oppsWeek },
  });
}
