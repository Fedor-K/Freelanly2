import { NextRequest, NextResponse } from 'next/server';
import { processInstantAlertQueue } from '@/services/alert-notifications';
import { matchAndQueueAutoApplies, processAutoApplyQueue, processFollowUps } from '@/services/auto-apply-processor';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';
import { prisma } from '@/lib/db';
import { sendTelegramAlert } from '@/lib/telegram-alerts';

const NO_SEND_ALERT_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

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

  // Only run on production to prevent duplicate emails from preview deployments
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ skipped: true, reason: 'non-production deployment' });
  }

  try {
    console.log('[Cron] Processing INSTANT alert queue...');

    const result = await processInstantAlertQueue();

    console.log(`[Cron] INSTANT alerts: ${result.newOpportunities} new opps, ${result.sent} emails sent, ${result.failed} failed, ${result.processed} matched, ${result.skippedDebounce} debounced`);

    // Auto-apply: match new opportunities to active loops + process queue
    try {
      const queued = await matchAndQueueAutoApplies();
      const autoResult = await processAutoApplyQueue();
      if (queued > 0 || autoResult.sent > 0) {
        console.log(`[Cron] Auto-Apply: queued ${queued}, sent ${autoResult.sent}, failed ${autoResult.failed}`);
      }
    } catch (autoError) {
      console.error('[Cron] Auto-Apply error:', autoError);
    }

    // Send follow-ups for applications without reply after 3 days
    try {
      const followUps = await processFollowUps();
      if (followUps.sent > 0) {
        console.log(`[Cron] Follow-ups: ${followUps.sent} sent, ${followUps.failed} failed`);
      }
    } catch (e) {
      console.error('[Cron] Follow-up error:', e);
    }

    // Check for replies to sent applications
    try {
      const { checkAllReplies } = await import('@/services/reply-checker');
      const replies = await checkAllReplies();
      if (replies > 0) console.log(`[Cron] Found ${replies} new replies to auto-applications`);
    } catch (e) {
      console.error('[Cron] Reply check error:', e);
    }

    // Monitor: alert if no emails sent for over 1 hour
    if (result.sent === 0) {
      const lastSentAlert = await prisma.jobAlert.findFirst({
        where: { lastSentAt: { not: null } },
        orderBy: { lastSentAt: 'desc' },
        select: { lastSentAt: true },
      });

      const lastSentAt = lastSentAlert?.lastSentAt;
      if (lastSentAt && Date.now() - lastSentAt.getTime() > NO_SEND_ALERT_THRESHOLD_MS) {
        const minutesAgo = Math.round((Date.now() - lastSentAt.getTime()) / 60000);
        await sendTelegramAlert({
          title: 'Job Alerts не отправляются',
          message: `Последняя рассылка была ${minutesAgo} мин назад. Новых вакансий: ${result.newOpportunities}, матчей: ${result.processed}.`,
          metadata: {
            lastSentAt: lastSentAt.toISOString(),
            newOpportunities: result.newOpportunities,
            processed: result.processed,
            failed: result.failed,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Cron] Error processing INSTANT alert queue:', error);

    // Alert on cron crash too
    await sendTelegramAlert({
      title: 'Job Alerts CRON упал',
      message: 'process-instant-alerts завершился с ошибкой',
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
