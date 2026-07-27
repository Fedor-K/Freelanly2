import { NextRequest, NextResponse } from 'next/server';
import { processAbandonedTopupRecovery } from '@/services/abandoned-topup-recovery';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * Win-back email for abandoned $3 balance top-ups (incomplete apply_credits PaymentIntents).
 * Vercel invokes crons via GET; POST kept for manual curl.
 *   curl -X POST https://freelanly.com/api/cron/recover-abandoned-topups -H "Authorization: Bearer $CRON_SECRET"
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function run(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const stats = await processAbandonedTopupRecovery();
    console.log('[Cron] recover-abandoned-topups:', stats);
    return NextResponse.json({ success: true, ...stats });
  } catch (e) {
    console.error('[Cron] recover-abandoned-topups error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
