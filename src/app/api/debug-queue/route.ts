/**
 * Debug: check and fix import task queue
 * GET = diagnostics, POST = clear stuck tasks
 * DELETE after use
 */
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { queueInstantAlertsForJob } from '@/services/alert-notifications';

const SETUP_KEY = 'fr33lanly-setup-2026';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== SETUP_KEY) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 });
  }

  const fix = req.nextUrl.searchParams.get('fix') === 'true';
  const backfillHours = parseInt(req.nextUrl.searchParams.get('backfill') || '0', 10);

  if (fix) {
    // Delete ALL import tasks — fresh start
    const deleted = await prisma.importTask.deleteMany({});
    return NextResponse.json({
      action: 'cleared',
      deleted: deleted.count,
      message: 'All import tasks deleted. Next fetch-sources cron will create fresh tasks.',
    });
  }

  if (backfillHours > 0) {
    // Debug: test queueInstantAlertsForOpportunity on a recent opp
    const recentOpp = await prisma.opportunity.findFirst({
      where: { createdAt: { gte: new Date(Date.now() - backfillHours * 60 * 60 * 1000) } },
      orderBy: { createdAt: 'desc' },
      include: { category: { select: { slug: true } } },
    });

    if (!recentOpp) {
      return NextResponse.json({ action: 'debug', error: 'No recent opportunities' });
    }

    // Check how many alerts match this opportunity
    const { queueInstantAlertsForOpportunity } = await import('@/services/alert-notifications');
    const result = await queueInstantAlertsForOpportunity(recentOpp.id);

    return NextResponse.json({
      action: 'debug-opp-match',
      opportunity: {
        id: recentOpp.id,
        title: recentOpp.title?.slice(0, 80),
        category: recentOpp.category?.slug,
        country: recentOpp.country,
        level: recentOpp.level,
        sourceLanguages: recentOpp.sourceLanguages,
        targetLanguages: recentOpp.targetLanguages,
      },
      queued: result.queued,
    });
  }

  const [pending, processing, retry3Plus, instantAlerts, pendingAll, pendingInstant, recentJobs, oppsToday, oppsWeek, sentToday, sentWeek, lastSent] = await Promise.all([
    prisma.importTask.count({ where: { status: 'PENDING' } }),
    prisma.importTask.count({ where: { status: 'PROCESSING' } }),
    prisma.importTask.count({ where: { status: 'PENDING', retryCount: { gte: 3 } } }),
    prisma.jobAlert.count({ where: { isActive: true, frequency: 'INSTANT' } }),
    prisma.alertNotification.count({ where: { status: 'PENDING' } }),
    prisma.alertNotification.count({
      where: {
        status: 'PENDING',
        jobAlert: { frequency: 'INSTANT', isActive: true },
      },
    }),
    prisma.job.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.alertNotification.count({
      where: { status: 'SENT', sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.alertNotification.count({
      where: { status: 'SENT', sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
    // Last sent notification timestamp
    prisma.alertNotification.findFirst({
      where: { status: 'SENT' },
      orderBy: { sentAt: 'desc' },
      select: { sentAt: true },
    }),
  ]);

  return NextResponse.json({
    importQueue: { pending, processing, stuckWithRetry3Plus: retry3Plus, allStuck: retry3Plus === pending },
    alerts: { instantAlerts, pendingAll, pendingInstant, sentToday, sentWeek, lastSentAt: lastSent?.sentAt, jobsLast24h: recentJobs, oppsToday, oppsWeek },
    fix: 'Add &fix=true to clear all import tasks',
  });
}
