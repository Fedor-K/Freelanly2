/**
 * Cron job to send nurture emails to FREE users who tried to apply
 * Recommended: Run every hour
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendNurtureEmails } from '@/services/nurture-emails';

export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting nurture email send...');

    const stats = await sendNurtureEmails();

    console.log(`[Cron] Nurture emails complete: ${stats.sent} sent, ${stats.failed} failed, ${stats.skipped} skipped`);

    return NextResponse.json({
      success: true,
      sent: stats.sent,
      failed: stats.failed,
      skipped: stats.skipped,
      errors: stats.errors.slice(0, 5), // Only first 5 errors
    });
  } catch (error) {
    console.error('[Cron] Nurture email error:', error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger nurture emails',
    description: 'Sends follow-up emails to FREE users who tried to apply in the last 1-24 hours',
  });
}
