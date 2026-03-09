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
    const skip = parseInt(req.nextUrl.searchParams.get('skip') || '0', 10);
    const take = 50;
    // Queue alerts for jobs created in the last N hours
    const recentJobs = await prisma.job.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - backfillHours * 60 * 60 * 1000) },
        isActive: true,
      },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    // Instead of full backfill, just check a sample job for debugging
    const sampleJob = recentJobs[0];
    if (!sampleJob) {
      return NextResponse.json({ action: 'backfill', error: 'No recent jobs found' });
    }

    const job = await prisma.job.findUnique({
      where: { id: sampleJob.id },
      include: { category: { select: { slug: true } } },
    });

    const instantAlertCount = await prisma.jobAlert.count({
      where: {
        isActive: true,
        frequency: 'INSTANT',
        OR: [
          { user: { emailVerified: { not: null }, unsubscribedFromMarketing: false } },
          { userId: null },
        ],
      },
    });

    // Check a few alerts to see why no match
    const sampleAlerts = await prisma.jobAlert.findMany({
      where: {
        isActive: true,
        frequency: 'INSTANT',
        OR: [
          { user: { emailVerified: { not: null }, unsubscribedFromMarketing: false } },
          { userId: null },
        ],
      },
      include: { languagePairs: true },
      take: 5,
    });

    return NextResponse.json({
      action: 'debug-match',
      sampleJob: {
        id: job?.id,
        category: job?.category?.slug,
        country: job?.country,
        level: job?.level,
        title: job?.title?.slice(0, 80),
        sourceLanguages: job?.sourceLanguages,
        targetLanguages: job?.targetLanguages,
      },
      instantAlertsEligible: instantAlertCount,
      sampleAlerts: sampleAlerts.map(a => ({
        id: a.id,
        category: a.category,
        keywords: a.keywords,
        country: a.country,
        level: a.level,
        langPairs: a.languagePairs.length,
      })),
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
