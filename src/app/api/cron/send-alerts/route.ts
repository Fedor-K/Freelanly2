import { NextRequest, NextResponse } from 'next/server';
import { findAlertsWithMatches } from '@/services/alert-matcher';
import { sendAlertNotifications } from '@/services/alert-notifications';
import { AlertFrequency } from '@prisma/client';

// Verify cron secret
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('[SendAlerts] CRON_SECRET not configured');
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * POST /api/cron/send-alerts
 *
 * Sends job alert notifications to users.
 *
 * Query params:
 * - frequency: INSTANT | DAILY | WEEKLY (default: DAILY)
 *
 * Should be called:
 * - INSTANT: after each job import
 * - DAILY: once a day (e.g., 7:00 UTC)
 * - WEEKLY: once a week (e.g., Monday 7:00 UTC)
 */
export async function POST(request: NextRequest) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const frequencyParam = searchParams.get('frequency')?.toUpperCase() || 'DAILY';

  // Validate frequency
  const validFrequencies: AlertFrequency[] = ['INSTANT', 'DAILY', 'WEEKLY'];
  if (!validFrequencies.includes(frequencyParam as AlertFrequency)) {
    return NextResponse.json(
      { error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}` },
      { status: 400 }
    );
  }

  const frequency = frequencyParam as AlertFrequency;

  console.log(`[SendAlerts] Starting ${frequency} alert notifications`);
  const startTime = Date.now();

  try {
    // Find alerts with matching jobs
    const alertsWithMatches = await findAlertsWithMatches(frequency);

    if (alertsWithMatches.length === 0) {
      console.log(`[SendAlerts] No ${frequency} alerts with new matching jobs`);
      return NextResponse.json({
        success: true,
        frequency,
        alertsProcessed: 0,
        emailsSent: 0,
        emailsFailed: 0,
        durationMs: Date.now() - startTime,
      });
    }

    // Send notifications
    const { sent, failed } = await sendAlertNotifications(alertsWithMatches);

    const durationMs = Date.now() - startTime;
    console.log(
      `[SendAlerts] Completed ${frequency} notifications in ${durationMs}ms: ${sent} sent, ${failed} failed`
    );

    return NextResponse.json({
      success: true,
      frequency,
      alertsProcessed: alertsWithMatches.length,
      totalJobsMatched: alertsWithMatches.reduce((sum, a) => sum + a.jobs.length, 0),
      emailsSent: sent,
      emailsFailed: failed,
      durationMs,
    });
  } catch (error) {
    console.error('[SendAlerts] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: String(error),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET(request: NextRequest) {
  return POST(request);
}
