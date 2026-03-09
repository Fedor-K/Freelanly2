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

  if (fix) {
    // Delete ALL import tasks — fresh start
    const deleted = await prisma.importTask.deleteMany({});
    return NextResponse.json({
      action: 'cleared',
      deleted: deleted.count,
      message: 'All import tasks deleted. Next fetch-sources cron will create fresh tasks.',
    });
  }

  const [pending, processing, retry3Plus, instantAlerts, pendingNotifications, recentJobs] = await Promise.all([
    prisma.importTask.count({ where: { status: 'PENDING' } }),
    prisma.importTask.count({ where: { status: 'PROCESSING' } }),
    prisma.importTask.count({ where: { status: 'PENDING', retryCount: { gte: 3 } } }),
    prisma.jobAlert.count({ where: { isActive: true, frequency: 'INSTANT' } }),
    prisma.alertNotification.count({ where: { status: 'PENDING' } }),
    prisma.job.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);

  return NextResponse.json({
    importQueue: { pending, processing, stuckWithRetry3Plus: retry3Plus, allStuck: retry3Plus === pending },
    alerts: { instantAlerts, pendingNotifications, jobsLast24h: recentJobs },
    fix: 'Add &fix=true to clear all import tasks',
  });
}
