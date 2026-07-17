import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';
import { processDay1Matches } from '@/services/day1-matches';

// Day+1 "your new matched roles" one-shot (2026-07-17). Runs HOURLY from the Hetzner crontab
// (like the other email drips — not vercel.json); the service self-selects users whose local
// clock is 09:00–11:59. Params: ?force=true (bypass hour gate), ?dryRun=true (report only),
// ?testEmail=addr (single-user smoke test, never stamps).
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const p = request.nextUrl.searchParams;
    const stats = await processDay1Matches({
      force: p.get('force') === 'true',
      dryRun: p.get('dryRun') === 'true',
      testEmail: p.get('testEmail') || undefined,
    });
    return NextResponse.json(stats);
  } catch (e) {
    console.error('[Day1Matches] cron failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
