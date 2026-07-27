import { NextRequest, NextResponse } from 'next/server';
import { processAbandonedWatcherSubs } from '@/services/abandoned-watcher-subs';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * Win-back email for abandoned $19/mo watcher subscriptions (incomplete in Stripe).
 *   curl -X POST https://freelanly.com/api/cron/recover-abandoned-watcher-subs -H "Authorization: Bearer $CRON_SECRET"
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function run(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const stats = await processAbandonedWatcherSubs();
    console.log('[Cron] recover-abandoned-watcher-subs:', stats);
    return NextResponse.json({ success: true, ...stats });
  } catch (e) {
    console.error('[Cron] recover-abandoned-watcher-subs error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
