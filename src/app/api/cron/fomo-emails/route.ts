import { NextRequest, NextResponse } from 'next/server';
import { processFomoEmails, getFomoEmailStats } from '@/services/fomo-email';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * Cron endpoint for FOMO emails
 * Sends "You missed X projects this week" to FREE users 3 days after registration
 *
 * POST /api/cron/fomo-emails
 * Authorization: Bearer $CRON_SECRET
 *
 * Schedule: daily at 9:00 UTC
 */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Starting FOMO emails...');

  try {
    const result = await processFomoEmails();

    console.log(`[Cron] FOMO emails complete: sent=${result.sent}, failed=${result.failed}, skipped=${result.skipped}`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Cron] FOMO emails error:', error);
    return NextResponse.json(
      { error: 'Failed to process FOMO emails', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET - Check FOMO email stats
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getFomoEmailStats();
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get stats', details: String(error) },
      { status: 500 }
    );
  }
}
