import { NextRequest, NextResponse } from 'next/server';
import { processAutoApplyQueue, matchAndQueueAutoApplies } from '@/services/auto-apply-processor';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';
import { sendTelegramAlert } from '@/lib/telegram-alerts';

/**
 * Process auto-apply queue
 * Should be called every 5-10 minutes by cron
 * Picks up PENDING AutoApplications, generates cover letters, sends via SMTP
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only run on production to prevent duplicate sends from preview deployments
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ skipped: true, reason: 'non-production deployment' });
  }

  try {
    console.log('[Cron] Matching new jobs to auto-apply loops...');
    const queued = await matchAndQueueAutoApplies();
    console.log(`[Cron] Queued ${queued} new auto-applications`);

    console.log('[Cron] Processing auto-apply queue...');
    const result = await processAutoApplyQueue();

    console.log(
      `[Cron] Auto-apply: ${result.processed} processed, ${result.sent} sent, ${result.failed} failed, ${result.skipped} skipped`
    );

    // Alert on high failure rate
    if (result.failed > 0 && result.failed >= result.sent) {
      await sendTelegramAlert({
        title: 'Auto-Apply: высокий процент ошибок',
        message: `Отправлено: ${result.sent}, ошибок: ${result.failed}, пропущено: ${result.skipped}`,
        metadata: {
          processed: result.processed,
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Cron] Error processing auto-apply queue:', error);

    // Alert on cron crash
    await sendTelegramAlert({
      title: 'Auto-Apply CRON упал',
      message: 'process-auto-apply завершился с ошибкой',
      error: String(error),
    }).catch(() => {});

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
