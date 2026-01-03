import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Queue all active data sources for background processing
 *
 * Creates ImportTask for each active source (if not already pending)
 * Returns immediately - actual processing happens via /api/cron/process-task
 *
 * Run daily at 6:00 UTC:
 * curl -X POST https://freelanly.com/api/cron/queue-sources -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Queue] Starting to queue data sources...');

    // Get all active data sources
    const dataSources = await prisma.dataSource.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sourceType: true,
        lastFetched: true,  // For priority calculation
      },
    });

    // Get already pending/processing tasks to avoid duplicates
    const existingTasks = await prisma.importTask.findMany({
      where: {
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      select: { dataSourceId: true },
    });
    const existingSourceIds = new Set(existingTasks.map(t => t.dataSourceId));

    // Create tasks for sources that don't have pending tasks
    const tasksToCreate = dataSources
      .filter(ds => !existingSourceIds.has(ds.id))
      .map(ds => ({
        dataSourceId: ds.id,
        // Priority: sources with fewer jobs get higher priority (faster to process)
        priority: ds.lastFetched ? Math.max(0, 1000 - ds.lastFetched) : 500,
      }));

    if (tasksToCreate.length === 0) {
      console.log('[Queue] All sources already have pending tasks');
      return NextResponse.json({
        success: true,
        tasksCreated: 0,
        alreadyQueued: existingTasks.length,
      });
    }

    // Bulk create tasks
    await prisma.importTask.createMany({
      data: tasksToCreate,
    });

    console.log(`[Queue] Created ${tasksToCreate.length} import tasks`);

    return NextResponse.json({
      success: true,
      tasksCreated: tasksToCreate.length,
      alreadyQueued: existingTasks.length,
      totalSources: dataSources.length,
    });
  } catch (error) {
    console.error('[Queue] Error:', error);
    return NextResponse.json(
      { error: 'Failed to queue sources', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
