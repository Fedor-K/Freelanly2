import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processDataSource } from '@/services/sources';

/**
 * Process one pending import task from the queue
 *
 * Picks up the highest priority pending task, processes it, and updates status.
 * Should be called every 2-3 minutes by cron to process tasks in sequence.
 *
 * Run every 2 minutes:
 * curl -X POST https://freelanly.com/api/cron/process-task -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check for stuck tasks (PROCESSING for more than 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const stuckTasks = await prisma.importTask.updateMany({
      where: {
        status: 'PROCESSING',
        startedAt: { lt: thirtyMinutesAgo },
      },
      data: {
        status: 'PENDING',  // Reset to pending for retry
        retryCount: { increment: 1 },
        error: 'Task timed out after 30 minutes',
      },
    });

    if (stuckTasks.count > 0) {
      console.log(`[ProcessTask] Reset ${stuckTasks.count} stuck tasks`);
    }

    // Get next pending task (highest priority first, oldest first within same priority)
    const task = await prisma.importTask.findFirst({
      where: {
        status: 'PENDING',
        retryCount: { lt: 3 },  // Max 3 retries
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
      include: {
        dataSource: {
          select: { id: true, name: true, sourceType: true },
        },
      },
    });

    if (!task) {
      return NextResponse.json({
        success: true,
        message: 'No pending tasks',
        queue: { pending: 0 },
      });
    }

    // Mark task as processing
    await prisma.importTask.update({
      where: { id: task.id },
      data: {
        status: 'PROCESSING',
        startedAt: new Date(),
      },
    });

    console.log(`[ProcessTask] Processing: ${task.dataSource.name} (task ${task.id})`);

    try {
      // Process the data source
      const stats = await processDataSource(task.dataSourceId);

      // Mark task as completed
      await prisma.importTask.update({
        where: { id: task.id },
        data: {
          status: 'COMPLETED',
          totalJobs: stats.total,
          processedJobs: stats.total,
          createdJobs: stats.created,
          skippedJobs: stats.skipped,
          completedAt: new Date(),
          error: null,
        },
      });

      console.log(`[ProcessTask] Completed: ${task.dataSource.name} - ${stats.created} created, ${stats.skipped} skipped`);

      // Get remaining queue stats
      const pendingCount = await prisma.importTask.count({
        where: { status: 'PENDING' },
      });

      return NextResponse.json({
        success: true,
        task: {
          id: task.id,
          source: task.dataSource.name,
          status: 'COMPLETED',
        },
        stats: {
          total: stats.total,
          created: stats.created,
          skipped: stats.skipped,
          failed: stats.failed,
        },
        queue: {
          pending: pendingCount,
        },
      });
    } catch (error) {
      // Mark task as failed
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

      console.error(`[ProcessTask] Failed: ${task.dataSource.name} (retry ${newRetryCount}/${task.maxRetries}):`, error);

      return NextResponse.json({
        success: false,
        task: {
          id: task.id,
          source: task.dataSource.name,
          status: isFinalFailure ? 'FAILED' : 'PENDING_RETRY',
          retryCount: newRetryCount,
        },
        error: String(error),
      });
    }
  } catch (error) {
    console.error('[ProcessTask] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process task', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // GET returns queue status without processing
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [pending, processing, completed, failed] = await Promise.all([
    prisma.importTask.count({ where: { status: 'PENDING' } }),
    prisma.importTask.count({ where: { status: 'PROCESSING' } }),
    prisma.importTask.count({ where: { status: 'COMPLETED' } }),
    prisma.importTask.count({ where: { status: 'FAILED' } }),
  ]);

  return NextResponse.json({
    queue: { pending, processing, completed, failed },
  });
}
