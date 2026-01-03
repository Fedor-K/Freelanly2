import { NextRequest, NextResponse } from 'next/server';
import { processAbandonedCheckoutEmails } from '@/services/abandoned-checkout-emails';

/**
 * Send abandoned checkout emails
 * Run hourly via cron
 *
 * curl -X POST https://freelanly.com/api/cron/send-abandoned-checkout-emails \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron] Starting abandoned checkout emails...');
    const startTime = Date.now();

    const stats = await processAbandonedCheckoutEmails();

    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`[Cron] Abandoned checkout emails done in ${duration}s:`, stats);

    return NextResponse.json({
      success: true,
      duration: `${duration}s`,
      stats: {
        processed: stats.processed,
        sent: stats.sent,
        skipped: stats.skipped,
        alreadySubscribed: stats.alreadySubscribed,
        failed: stats.failed,
      },
    });
  } catch (error) {
    console.error('[Cron] Abandoned checkout emails error:', error);
    return NextResponse.json(
      { error: 'Failed to process abandoned checkout emails', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
