import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';
import { buildAtsDayDrafts } from '@/services/sources/ats-day-drafts';

/**
 * Build (not send) outreach drafts from TODAY's ATS opportunity flow — every ats_lever vacancy
 * ingested today that clears both gates (resolvable contact + strong vetted shortlist). Feeds the
 * today's-ATS view on /admin/recruiter-outreach. Run daily on the Hetzner worker (Bearer CRON_SECRET;
 * port 25 → verified contacts, no timeout). Never sends email.
 */
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const day = url.searchParams.get('date') || undefined; // YYYY-MM-DD (MSK); default today
    // offset+limit = a window of roles to vet this call (batching under Vercel's ~60s cap). The nightly
    // worker loops with offset += limit until `remaining` = 0. No offset/limit = whole day (manual run).
    const int = (k: string) => { const n = parseInt(url.searchParams.get(k) || '', 10); return Number.isFinite(n) && n > 0 ? n : undefined; };
    const offset = int('offset');
    const limit = int('limit');
    const result = await buildAtsDayDrafts({ day, offset, limit });
    console.log(`[Cron] build-ats-outreach${day ? ` (${day})` : ''} off=${offset ?? 0} lim=${limit ?? 'all'}: vacancies=${result.vacancies}, created=${result.created}, noContact=${result.noContact}, noCandidates=${result.noCandidates}, existing=${result.existing}, remaining=${result.remaining}`);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron] build-ats-outreach failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
