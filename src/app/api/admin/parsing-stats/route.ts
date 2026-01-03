import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Get comprehensive parsing statistics for admin dashboard
 *
 * GET /api/admin/parsing-stats
 */
export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Queue stats
    const [pendingTasks, processingTasks, completedToday, failedToday] = await Promise.all([
      prisma.importTask.count({ where: { status: 'PENDING' } }),
      prisma.importTask.count({ where: { status: 'PROCESSING' } }),
      prisma.importTask.count({
        where: { status: 'COMPLETED', completedAt: { gte: todayStart } },
      }),
      prisma.importTask.count({
        where: { status: 'FAILED', completedAt: { gte: todayStart } },
      }),
    ]);

    // Today's import stats
    const todayStats = await prisma.importTask.aggregate({
      where: { status: 'COMPLETED', completedAt: { gte: todayStart } },
      _sum: { createdJobs: true, skippedJobs: true, totalJobs: true },
    });

    // Yesterday stats for comparison
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStats = await prisma.importTask.aggregate({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: yesterdayStart, lt: todayStart },
      },
      _sum: { createdJobs: true },
    });

    // Weekly stats by day
    const weeklyStats = await prisma.$queryRaw<Array<{ date: Date; created: bigint; skipped: bigint }>>`
      SELECT
        DATE("completedAt") as date,
        SUM("createdJobs") as created,
        SUM("skippedJobs") as skipped
      FROM "ImportTask"
      WHERE status = 'COMPLETED' AND "completedAt" >= ${weekAgo}
      GROUP BY DATE("completedAt")
      ORDER BY date DESC
      LIMIT 7
    `;

    // Source health
    const [healthySources, emptySources, errorSources] = await Promise.all([
      prisma.dataSource.count({
        where: { isActive: true, errorCount: 0 },
      }),
      prisma.dataSource.count({
        where: { isActive: true, lastFetched: 0 },
      }),
      prisma.dataSource.count({
        where: { isActive: true, errorCount: { gt: 0 } },
      }),
    ]);

    // Problem sources (errors in last 24h)
    const problemSources = await prisma.dataSource.findMany({
      where: {
        isActive: true,
        OR: [
          { errorCount: { gt: 0 } },
          { lastFetched: 0, lastRunAt: { gte: weekAgo } },
        ],
      },
      select: {
        id: true,
        name: true,
        lastError: true,
        lastRunAt: true,
        lastFetched: true,
        errorCount: true,
      },
      orderBy: { errorCount: 'desc' },
      take: 10,
    });

    // Top sources by jobs created (last 7 days)
    const topSources = await prisma.importTask.groupBy({
      by: ['dataSourceId'],
      where: { status: 'COMPLETED', completedAt: { gte: weekAgo } },
      _sum: { createdJobs: true, totalJobs: true },
      orderBy: { _sum: { createdJobs: 'desc' } },
      take: 10,
    });

    // Get source names for top sources
    const topSourceIds = topSources.map(s => s.dataSourceId);
    const topSourceNames = await prisma.dataSource.findMany({
      where: { id: { in: topSourceIds } },
      select: { id: true, name: true },
    });
    const sourceNameMap = new Map(topSourceNames.map(s => [s.id, s.name]));

    // Worst sources by conversion rate
    const worstSources = await prisma.importTask.groupBy({
      by: ['dataSourceId'],
      where: {
        status: 'COMPLETED',
        completedAt: { gte: weekAgo },
        totalJobs: { gt: 10 },
      },
      _sum: { createdJobs: true, totalJobs: true },
      having: { totalJobs: { _sum: { gt: 50 } } },
      orderBy: { _sum: { createdJobs: 'asc' } },
      take: 5,
    });

    // Get source names for worst sources
    const worstSourceIds = worstSources.map(s => s.dataSourceId);
    const worstSourceNames = await prisma.dataSource.findMany({
      where: { id: { in: worstSourceIds } },
      select: { id: true, name: true },
    });
    const worstSourceNameMap = new Map(worstSourceNames.map(s => [s.id, s.name]));

    // Indexing stats
    const [indexingToday, indexingWeek] = await Promise.all([
      prisma.indexingLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: todayStart } },
        _sum: { urlsCount: true, success: true, failed: true },
      }),
      prisma.indexingLog.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: weekAgo } },
        _sum: { urlsCount: true, success: true, failed: true },
      }),
    ]);

    // Last indexing submission (overall)
    const lastIndexing = await prisma.indexingLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { provider: true, createdAt: true, success: true, failed: true, error: true },
    });

    // Last Google submission (to show specific error)
    const lastGoogleSubmission = await prisma.indexingLog.findFirst({
      where: { provider: 'GOOGLE' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, success: true, failed: true, error: true },
    });

    // Last IndexNow submission
    const lastIndexNowSubmission = await prisma.indexingLog.findFirst({
      where: { provider: 'INDEXNOW' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, success: true, failed: true, error: true },
    });

    // AI usage estimation (from import tasks)
    const aiCallsToday = todayStats._sum.totalJobs || 0;
    const aiCallsWeek = await prisma.importTask.aggregate({
      where: { status: 'COMPLETED', completedAt: { gte: weekAgo } },
      _sum: { totalJobs: true },
    });

    // Calculate ETA
    let estimatedMinutesRemaining: number | null = null;
    if (pendingTasks > 0) {
      const recentCompleted = await prisma.importTask.findMany({
        where: { status: 'COMPLETED', completedAt: { gte: todayStart } },
        select: { startedAt: true, completedAt: true },
        orderBy: { completedAt: 'desc' },
        take: 10,
      });

      if (recentCompleted.length > 0) {
        const avgDuration = recentCompleted.reduce((sum, t) => {
          if (t.startedAt && t.completedAt) {
            return sum + (t.completedAt.getTime() - t.startedAt.getTime());
          }
          return sum;
        }, 0) / recentCompleted.length;
        estimatedMinutesRemaining = Math.round((pendingTasks * avgDuration) / 60000);
      }
    }

    // Currently processing task
    const currentTask = await prisma.importTask.findFirst({
      where: { status: 'PROCESSING' },
      include: { dataSource: { select: { name: true } } },
    });

    // Calculate change percentage
    const todayCreated = todayStats._sum.createdJobs || 0;
    const yesterdayCreated = yesterdayStats._sum.createdJobs || 0;
    const changePercent = yesterdayCreated > 0
      ? Math.round(((todayCreated - yesterdayCreated) / yesterdayCreated) * 100)
      : null;

    // Generate alerts
    const alerts: Array<{ type: 'warning' | 'error' | 'success'; message: string }> = [];

    if (errorSources > 0) {
      alerts.push({ type: 'error', message: `${errorSources} источников с ошибками` });
    }
    if (emptySources > 5) {
      alerts.push({ type: 'warning', message: `${emptySources} источников без вакансий` });
    }
    if (failedToday > 5) {
      alerts.push({ type: 'error', message: `${failedToday} задач провалились сегодня` });
    }
    if (processingTasks === 0 && pendingTasks > 0) {
      alerts.push({ type: 'warning', message: 'Очередь не обрабатывается' });
    }
    if (pendingTasks === 0 && processingTasks === 0) {
      alerts.push({ type: 'success', message: 'Очередь пуста, всё обработано' });
    }

    // Format indexing stats
    const indexingStats = {
      google: {
        today: indexingToday.find(i => i.provider === 'GOOGLE')?._sum || { urlsCount: 0, success: 0, failed: 0 },
        week: indexingWeek.find(i => i.provider === 'GOOGLE')?._sum || { urlsCount: 0, success: 0, failed: 0 },
        lastSubmission: lastGoogleSubmission,
      },
      indexNow: {
        today: indexingToday.find(i => i.provider === 'INDEXNOW')?._sum || { urlsCount: 0, success: 0, failed: 0 },
        week: indexingWeek.find(i => i.provider === 'INDEXNOW')?._sum || { urlsCount: 0, success: 0, failed: 0 },
        lastSubmission: lastIndexNowSubmission,
      },
      lastSubmission: lastIndexing,
    };

    return NextResponse.json({
      queue: {
        pending: pendingTasks,
        processing: processingTasks,
        completedToday,
        failedToday,
        estimatedMinutesRemaining,
        totalProgress: completedToday + failedToday + pendingTasks + processingTasks > 0
          ? Math.round(((completedToday + failedToday) / (completedToday + failedToday + pendingTasks + processingTasks)) * 100)
          : 0,
      },
      current: currentTask ? {
        source: currentTask.dataSource.name,
        startedAt: currentTask.startedAt,
        progress: currentTask.totalJobs > 0 ? `${currentTask.processedJobs}/${currentTask.totalJobs}` : 'Starting...',
      } : null,
      today: {
        sources: completedToday,
        found: todayStats._sum.totalJobs || 0,
        created: todayCreated,
        skipped: todayStats._sum.skippedJobs || 0,
        changePercent,
        conversionRate: (todayStats._sum.totalJobs || 0) > 0
          ? Math.round((todayCreated / (todayStats._sum.totalJobs || 1)) * 100 * 10) / 10
          : 0,
      },
      weekly: weeklyStats.map(s => ({
        date: s.date,
        created: Number(s.created),
        skipped: Number(s.skipped),
      })),
      health: {
        healthy: healthySources,
        empty: emptySources,
        errors: errorSources,
        problems: problemSources.map(s => ({
          name: s.name,
          error: s.lastError,
          lastRun: s.lastRunAt,
          fetched: s.lastFetched,
          errorCount: s.errorCount,
        })),
      },
      topSources: topSources.map(s => ({
        name: sourceNameMap.get(s.dataSourceId) || 'Unknown',
        created: s._sum.createdJobs || 0,
        total: s._sum.totalJobs || 0,
        conversion: (s._sum.totalJobs || 0) > 0
          ? Math.round(((s._sum.createdJobs || 0) / (s._sum.totalJobs || 1)) * 100)
          : 0,
      })),
      worstSources: worstSources.map(s => ({
        name: worstSourceNameMap.get(s.dataSourceId) || 'Unknown',
        created: s._sum.createdJobs || 0,
        total: s._sum.totalJobs || 0,
        conversion: (s._sum.totalJobs || 0) > 0
          ? Math.round(((s._sum.createdJobs || 0) / (s._sum.totalJobs || 1)) * 100 * 10) / 10
          : 0,
      })),
      indexing: indexingStats,
      ai: {
        callsToday: aiCallsToday,
        callsWeek: aiCallsWeek._sum.totalJobs || 0,
        // Z.ai pricing: $0.10 per 1M tokens, ~500 tokens per call = $0.00005 per call
        costToday: Math.round((aiCallsToday as number) * 0.00005 * 100) / 100,
        costWeek: Math.round(((aiCallsWeek._sum.totalJobs || 0) as number) * 0.00005 * 100) / 100,
      },
      alerts,
    });
  } catch (error) {
    console.error('[ParsingStats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get parsing stats', details: String(error) },
      { status: 500 }
    );
  }
}
