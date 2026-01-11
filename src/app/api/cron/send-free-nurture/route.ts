import { NextRequest, NextResponse } from 'next/server';
import { processFreeNurtureEmails, getFreeNurtureStats } from '@/services/free-nurture-emails';

/**
 * Cron endpoint for sending FREE user nurture emails
 * Runs hourly to send drip emails to convert FREE → PRO
 *
 * POST /api/cron/send-free-nurture
 * Authorization: Bearer $CRON_SECRET
 *
 * Sequence:
 * - Day 1: Welcome email with 5 job picks
 * - Day 3: "These are going fast" (if no apply attempts)
 * - Day 7: "Try PRO free for 2 days" (if still FREE)
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Starting FREE user nurture emails...');

  try {
    const result = await processFreeNurtureEmails();

    console.log(`[Cron] FREE nurture complete: sent=${result.sent}, failed=${result.failed}, skipped=${result.skipped}`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[Cron] FREE nurture error:', error);
    return NextResponse.json(
      { error: 'Failed to process nurture emails', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET - Check nurture stats
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getFreeNurtureStats();
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get stats', details: String(error) },
      { status: 500 }
    );
  }
}
