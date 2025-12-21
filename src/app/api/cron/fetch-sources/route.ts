import { NextRequest, NextResponse } from 'next/server';
import { processAllSources } from '@/services/sources';

// Cron job endpoint for processing all ATS sources
// Run daily at 6:00 UTC via cron:
// curl -X POST http://localhost:3000/api/cron/fetch-sources -H "Authorization: Bearer $CRON_SECRET"

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting daily ATS sources fetch...');

    const results = await processAllSources();

    // Calculate totals
    const totals = {
      sources: Object.keys(results).length,
      created: 0,
      skipped: 0,
      failed: 0,
    };

    for (const stats of Object.values(results)) {
      totals.created += stats.created;
      totals.skipped += stats.skipped;
      totals.failed += stats.failed;
    }

    console.log(`[Cron] Completed: ${totals.sources} sources, ${totals.created} new jobs`);

    return NextResponse.json({
      success: true,
      totals,
      results,
    });
  } catch (error) {
    console.error('[Cron] ATS fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sources', details: String(error) },
      { status: 500 }
    );
  }
}

// GET - same as POST for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
