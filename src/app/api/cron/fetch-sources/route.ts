import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processDataSource } from '@/services/sources';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * Queue-based source fetching with PARALLEL processing
 *
 * 1. Creates import tasks for all active sources
 * 2. Processes them in parallel batches until timeout or completion
 *
 * Run 3x daily at 6:00, 14:00, 22:00 UTC via cron:
 * curl -X POST https://freelanly.com/api/cron/fetch-sources -H "Authorization: Bearer $CRON_SECRET"
 */

const MAX_EXECUTION_TIME = 4.5 * 60 * 1000; // 4.5 minutes max (Vercel Pro limit is 5 min)
const TASK_TIMEOUT = 30 * 60 * 1000; // 30 min = stuck task
const PARALLEL_TASKS = 10; // Process 10 sources in parallel

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
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

    // Step 3: Process tasks in PARALLEL batches until timeout
    while (Date.now() - startTime < MAX_EXECUTION_TIME) {
      // Get batch of pending tasks
      const tasks = await prisma.importTask.findMany({
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
        take: PARALLEL_TASKS,
      });

      if (tasks.length === 0) {
        console.log('[FetchSources] No more pending tasks');
        break;
      }

      // Mark all as processing
      await prisma.importTask.updateMany({
        where: { id: { in: tasks.map(t => t.id) } },
        data: { status: 'PROCESSING', startedAt: new Date() },
      });

      console.log(`[FetchSources] Processing batch of ${tasks.length}: ${tasks.map(t => t.dataSource.name).join(', ')}`);

      // Process all tasks in parallel
      const results = await Promise.allSettled(
        tasks.map(async (task) => {
          try {
            const result = await processDataSource(task.dataSourceId);

            // Delete task after successful completion
            await prisma.importTask.delete({
              where: { id: task.id },
            });

            return { task, success: true, result };
          } catch (error) {
            const newRetryCount = task.retryCount + 1;
            const isFinalFailure = newRetryCount >= task.maxRetries;

            if (isFinalFailure) {
              await prisma.importTask.delete({
                where: { id: task.id },
              });
            } else {
              await prisma.importTask.update({
                where: { id: task.id },
                data: {
                  status: 'PENDING',
                  retryCount: newRetryCount,
                  error: String(error),
                },
              });
            }

            return { task, success: false, error, isFinalFailure };
          }
        })
      );

      // Aggregate results
      for (const r of results) {
        if (r.status === 'fulfilled') {
          const { task, success, result, isFinalFailure } = r.value;
          if (success && result) {
            stats.processed++;
            stats.created += result.created;
            stats.skipped += result.skipped;
            console.log(`[FetchSources] Done: ${task.dataSource.name} (+${result.created} jobs)`);
          } else {
            if (isFinalFailure) stats.failed++;
            console.error(`[FetchSources] Error: ${task.dataSource.name}`);
          }
        } else {
          // Promise rejected (shouldn't happen with our try/catch)
          console.error(`[FetchSources] Unexpected error:`, r.reason);
          stats.failed++;
        }
      }

      // Small delay between batches to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 500));
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
