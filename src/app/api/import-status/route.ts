import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Get import queue status and recent activity
 *
 * No auth required - read-only endpoint for monitoring
 *
 * GET /api/import-status
 */
export async function GET(request: NextRequest) {
  try {
    // Get queue counts
    const [pending, processing, completedToday, failedToday] = await Promise.all([
      prisma.importTask.count({ where: { status: 'PENDING' } }),
      prisma.importTask.count({ where: { status: 'PROCESSING' } }),
      prisma.importTask.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.importTask.count({
        where: {
          status: 'FAILED',
          completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Get currently processing task
    const currentTask = await prisma.importTask.findFirst({
      where: { status: 'PROCESSING' },
      include: {
        dataSource: { select: { name: true, sourceType: true } },
      },
    });

    // Get recent completed tasks (last 10)
    const recentTasks = await prisma.importTask.findMany({
      where: { status: { in: ['COMPLETED', 'FAILED'] } },
      orderBy: { completedAt: 'desc' },
      take: 10,
      include: {
        dataSource: { select: { name: true, sourceType: true } },
      },
    });

    // Calculate stats from today's completed tasks
    const todayStats = await prisma.importTask.aggregate({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      _sum: {
        createdJobs: true,
        skippedJobs: true,
        totalJobs: true,
      },
    });

    // Estimate time remaining
    let estimatedMinutesRemaining: number | null = null;
    if (pending > 0 && recentTasks.length > 0) {
      const completedTasks = recentTasks.filter(t => t.status === 'COMPLETED' && t.startedAt && t.completedAt);
      if (completedTasks.length > 0) {
        const avgDurationMs = completedTasks.reduce((sum, t) => {
          return sum + (t.completedAt!.getTime() - t.startedAt!.getTime());
        }, 0) / completedTasks.length;
        estimatedMinutesRemaining = Math.round((pending * avgDurationMs) / 60000);
      }
    }

    return NextResponse.json({
      queue: {
        pending,
        processing,
        completedToday,
        failedToday,
        estimatedMinutesRemaining,
      },
      current: currentTask ? {
        source: currentTask.dataSource.name,
        sourceType: currentTask.dataSource.sourceType,
        startedAt: currentTask.startedAt,
        progress: currentTask.totalJobs > 0
          ? `${currentTask.processedJobs}/${currentTask.totalJobs}`
          : 'Starting...',
      } : null,
      todayStats: {
        created: todayStats._sum.createdJobs || 0,
        skipped: todayStats._sum.skippedJobs || 0,
        total: todayStats._sum.totalJobs || 0,
      },
      recent: recentTasks.map(t => ({
        source: t.dataSource.name,
        status: t.status,
        created: t.createdJobs,
        skipped: t.skippedJobs,
        completedAt: t.completedAt,
        error: t.error,
      })),
    });
  } catch (error) {
    console.error('[ImportStatus] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get import status', details: String(error) },
      { status: 500 }
    );
  }
}
