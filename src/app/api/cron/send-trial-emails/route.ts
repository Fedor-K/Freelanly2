import { NextRequest, NextResponse } from 'next/server';
import { processTrialEmails, getTrialEmailStats } from '@/services/trial-emails';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * Process trial onboarding emails
 * POST /api/cron/send-trial-emails
 *
 * Should be called every hour to send emails to users at the right time
 * Day 0: Welcome
 * Day 2: Features
 * Day 5: Social proof
 * Day 6: Urgency
 * Day 7: Last chance
 */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[TrialEmails] Starting trial email processing...');

    const result = await processTrialEmails();

    console.log(`[TrialEmails] Completed: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[TrialEmails] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process trial emails', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get trial email statistics
 * GET /api/cron/send-trial-emails
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getTrialEmailStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[TrialEmails] Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get stats', details: String(error) },
      { status: 500 }
    );
  }
}
