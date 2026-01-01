import { NextRequest, NextResponse } from 'next/server';
import { processReengagementEmails } from '@/services/reengagement-emails';

/**
 * Process re-engagement emails for inactive users
 * POST /api/cron/send-reengagement-emails
 *
 * Should be called daily to send emails to users who haven't visited:
 * Day 7:  "We noticed you've been away"
 * Day 14: "New jobs matching your interests"
 * Day 30: "Your job alerts are waiting"
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[ReengagementEmails] Starting re-engagement email processing...');

    const result = await processReengagementEmails();

    console.log(`[ReengagementEmails] Completed: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    console.error('[ReengagementEmails] Cron error:', error);
    return NextResponse.json(
      { error: 'Failed to process re-engagement emails', details: String(error) },
      { status: 500 }
    );
  }
}
