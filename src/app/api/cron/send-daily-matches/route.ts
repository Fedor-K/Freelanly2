import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';
import { processDailyMatches } from '@/services/daily-matches';

// Recurring daily "new matched roles" digest. Fire HOURLY; the service self-selects users whose
// local clock is 09:00–11:59 and who have not been sent in ~20h, so one hourly cron delivers to
// every timezone at its own morning. Params: ?force=true (bypass hour/recent gates),
// ?dryRun=true (report only, no sends/stamps), ?testEmail=addr (single-user smoke test, never stamps).
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const p = request.nextUrl.searchParams;
    const stats = await processDailyMatches({
      force: p.get('force') === 'true',
      dryRun: p.get('dryRun') === 'true',
      testEmail: p.get('testEmail') || undefined,
    });
    return NextResponse.json(stats);
  } catch (e) {
    console.error('[DailyMatches] cron failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

// Vercel cron sends GET.
export async function GET(request: NextRequest) {
  return POST(request);
}
