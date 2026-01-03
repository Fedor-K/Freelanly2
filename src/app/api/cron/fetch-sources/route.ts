import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processDataSource } from '@/services/sources';

/**
 * Queue-based source fetching with automatic processing
 *
 * 1. Creates import tasks for all active sources
 * 2. Processes them one by one until timeout or completion
 *
 * Run daily at 6:00 UTC via cron:
 * curl -X POST https://freelanly.com/api/cron/fetch-sources -H "Authorization: Bearer $CRON_SECRET"
 */

const MAX_EXECUTION_TIME = 55 * 60 * 1000; // 55 minutes max (leave buffer)
const TASK_TIMEOUT = 30 * 60 * 1000; // 30 min = stuck task

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const stats = {
    queued: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    remaining: 0,
  };

  try {
    console.log('[FetchSources] Starting...');

    // Step 1: Reset stuck tasks
    const stuckReset = await prisma.importTask.updateMany({
      where: {
        status: 'PROCESSING',
        startedAt: { lt: new Date(Date.now() - TASK_TIMEOUT) },
      },
      data: {
        status: 'PENDING',
        retryCount: { increment: 1 },
        error: 'Task timed out',
      },
    });
    if (stuckReset.count > 0) {
      console.log(`[FetchSources] Reset ${stuckReset.count} stuck tasks`);
    }

    // Step 2: Queue new tasks for sources without pending/processing tasks
    const activeSources = await prisma.dataSource.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const existingTasks = await prisma.importTask.findMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      select: { dataSourceId: true },
    });
    const busySourceIds = new Set(existingTasks.map(t => t.dataSourceId));

    const sourcesToQueue = activeSources.filter(s => !busySourceIds.has(s.id));

    if (sourcesToQueue.length > 0) {
      await prisma.importTask.createMany({
        data: sourcesToQueue.map(source => ({
          dataSourceId: source.id,
          status: 'PENDING',
          priority: 0,
        })),
      });
      stats.queued = sourcesToQueue.length;
      console.log(`[FetchSources] Queued ${stats.queued} new tasks`);
    }

    // Step 3: Process tasks until timeout
    while (Date.now() - startTime < MAX_EXECUTION_TIME) {
      // Get next pending task
      const task = await prisma.importTask.findFirst({
        where: {
          status: 'PENDING',
          retryCount: { lt: 3 },
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
        include: {
          dataSource: { select: { id: true, name: true } },
        },
      });

      if (!task) {
        console.log('[FetchSources] No more pending tasks');
        break;
      }

      // Mark as processing
      await prisma.importTask.update({
        where: { id: task.id },
        data: { status: 'PROCESSING', startedAt: new Date() },
      });

      console.log(`[FetchSources] Processing: ${task.dataSource.name}`);

      try {
        const result = await processDataSource(task.dataSourceId);

        await prisma.importTask.update({
          where: { id: task.id },
          data: {
            status: 'COMPLETED',
            totalJobs: result.total,
            processedJobs: result.total,
            createdJobs: result.created,
            skippedJobs: result.skipped,
            completedAt: new Date(),
            error: null,
          },
        });

        stats.processed++;
        stats.created += result.created;
        stats.skipped += result.skipped;

        console.log(`[FetchSources] Done: ${task.dataSource.name} (+${result.created} jobs)`);
      } catch (error) {
        const newRetryCount = task.retryCount + 1;
        const isFinalFailure = newRetryCount >= task.maxRetries;

        await prisma.importTask.update({
          where: { id: task.id },
          data: {
            status: isFinalFailure ? 'FAILED' : 'PENDING',
            retryCount: newRetryCount,
            error: String(error),
            completedAt: isFinalFailure ? new Date() : null,
          },
        });

        if (isFinalFailure) stats.failed++;
        console.error(`[FetchSources] Error: ${task.dataSource.name}:`, error);
      }
    }

    // Get remaining count
    stats.remaining = await prisma.importTask.count({
      where: { status: 'PENDING' },
    });

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`[FetchSources] Finished in ${duration}s: ${stats.processed} processed, ${stats.created} created, ${stats.remaining} remaining`);

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      stats,
    });
  } catch (error) {
    console.error('[FetchSources] Fatal error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sources', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
