import { NextRequest, NextResponse } from 'next/server';
import { processWinbackEmails, getWinbackEmailStats } from '@/services/winback-emails';

/**
 * Process win-back emails for churned users
 * POST /api/cron/send-winback-emails
 *
 * Should be called daily to send emails to users who churned:
 * Day 7:  "We miss you" + what's new
 * Day 14: Special offer (50% off)
 * Day 30: Last chance (60% off)
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[WinbackEmails] Starting win-back email processing...');

    const result = await processWinbackEmails();

    console.log(`[WinbackEmails] Completed: ${result.sent} sent, ${result.skipped} skipped, ${result.resubscribed} already resubscribed, ${result.failed} failed`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[WinbackEmails] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process win-back emails', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get win-back email statistics
 * GET /api/cron/send-winback-emails
 */
export async function GET(request: NextRequest) {
  // Verify admin secret
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getWinbackEmailStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[WinbackEmails] Stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get stats', details: String(error) },
      { status: 500 }
    );
  }
}
