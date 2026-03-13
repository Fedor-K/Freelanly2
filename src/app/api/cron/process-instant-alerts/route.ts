import { NextRequest, NextResponse } from 'next/server';
import { processInstantAlertQueue } from '@/services/alert-notifications';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * Process INSTANT alert queue
 * Should be called every 5-10 minutes by cron
 * Groups pending notifications by user and sends ONE email per user
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Processing INSTANT alert queue...');

    const result = await processInstantAlertQueue();

    console.log(`[Cron] INSTANT alerts processed: ${result.sent} emails sent, ${result.failed} failed, ${result.processed} opportunities, ${result.skippedDebounce || 0} debounced`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Cron] Error processing INSTANT alert queue:', error);
    return NextResponse.json(
      { error: 'Failed to process queue', details: String(error) },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
