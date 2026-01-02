import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processDataSource } from '@/services/sources';

// In-memory storage for bulk run progress
// In production, use Redis or database
interface BulkRunProgress {
  isRunning: boolean;
  currentIndex: number;
  totalCount: number;
  currentSourceName: string;
  stats: {
    created: number;
    skipped: number;
    failed: number;
    errors: string[];
  };
  startTime: number;
  endTime?: number;
  cancelled: boolean;
}

let bulkRunProgress: BulkRunProgress | null = null;
let cancelRequested = false;

// POST - Start bulk run of all active sources
export async function POST(request: NextRequest) {
  // Check if already running
  if (bulkRunProgress?.isRunning) {
    return NextResponse.json(
      { error: 'Bulk run already in progress', progress: bulkRunProgress },
      { status: 409 }
    );
  }

  try {
    // Get all active sources
    const activeSources = await prisma.dataSource.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, sourceType: true, companySlug: true, apiUrl: true },
    });

    if (activeSources.length === 0) {
      return NextResponse.json({ error: 'No active sources to run' }, { status: 400 });
    }

    // Reset cancel flag
    cancelRequested = false;

    // Initialize progress
    bulkRunProgress = {
      isRunning: true,
      currentIndex: 0,
      totalCount: activeSources.length,
      currentSourceName: activeSources[0].name,
      stats: { created: 0, skipped: 0, failed: 0, errors: [] },
      startTime: Date.now(),
      cancelled: false,
    };

    // Start background processing (don't await - run in background)
    runAllSourcesBackground(activeSources);

    return NextResponse.json({
      success: true,
      message: `Started running ${activeSources.length} sources`,
      progress: bulkRunProgress,
    });
  } catch (error) {
    console.error('Failed to start bulk run:', error);
    return NextResponse.json(
      { error: 'Failed to start bulk run', details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Get current progress
export async function GET() {
  return NextResponse.json({ progress: bulkRunProgress });
}

// DELETE - Cancel bulk run
export async function DELETE() {
  if (!bulkRunProgress?.isRunning) {
    return NextResponse.json({ error: 'No bulk run in progress' }, { status: 400 });
  }

  cancelRequested = true;
  return NextResponse.json({ success: true, message: 'Cancel requested' });
}

// Background function to run all sources
async function runAllSourcesBackground(
  sources: { id: string; name: string; sourceType: string; companySlug: string | null; apiUrl: string | null }[]
) {
  const stats = { created: 0, skipped: 0, failed: 0, errors: [] as string[] };

  for (let i = 0; i < sources.length; i++) {
    // Check for cancel
    if (cancelRequested) {
      if (bulkRunProgress) {
        bulkRunProgress.isRunning = false;
        bulkRunProgress.cancelled = true;
        bulkRunProgress.endTime = Date.now();
      }
      break;
    }

    const source = sources[i];

    // Update progress
    if (bulkRunProgress) {
      bulkRunProgress.currentIndex = i;
      bulkRunProgress.currentSourceName = source.name;
    }

    try {
      const result = await processDataSource(source.id);

      if (result) {
        stats.created += result.created || 0;
        stats.skipped += result.skipped || 0;
      }
    } catch (error) {
      stats.failed++;
      stats.errors.push(`${source.name}: ${String(error)}`);
    }

    // Update stats
    if (bulkRunProgress) {
      bulkRunProgress.stats = { ...stats };
    }
  }

  // Complete
  if (bulkRunProgress && !cancelRequested) {
    bulkRunProgress.isRunning = false;
    bulkRunProgress.currentIndex = sources.length;
    bulkRunProgress.endTime = Date.now();
  }
}
