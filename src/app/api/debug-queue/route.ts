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
    // Queue alerts for jobs created in the last N hours that don't have notifications yet
    const recentJobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - backfillHours * 60 * 60 * 1000) },
        isActive: true,
      },
      select: { id: true },
    });

    let queued = 0;
    for (const job of recentJobs) {
      try {
        const result = await queueInstantAlertsForJob(job.id);
        queued += result.queued;
      } catch {
        // skip errors
      }
    }
    return NextResponse.json({
      action: 'backfill',
      jobsChecked: recentJobs.length,
      notificationsQueued: queued,
    });
  }

  const [pending, processing, retry3Plus, instantAlerts, pendingAll, pendingInstant, recentJobs, sentToday, sentWeek] = await Promise.all([
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
    prisma.alertNotification.count({
      where: { status: 'SENT', sentAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
    prisma.alertNotification.count({
      where: { status: 'SENT', sentAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    }),
  ]);

  return NextResponse.json({
    importQueue: { pending, processing, stuckWithRetry3Plus: retry3Plus, allStuck: retry3Plus === pending },
    alerts: { instantAlerts, pendingAll, pendingInstant, sentToday, sentWeek, jobsLast24h: recentJobs },
    fix: 'Add &fix=true to clear all import tasks',
  });
}
