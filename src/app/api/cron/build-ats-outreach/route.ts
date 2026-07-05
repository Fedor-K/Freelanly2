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
    const day = new URL(request.url).searchParams.get('date') || undefined; // YYYY-MM-DD (MSK); default today
    const result = await buildAtsDayDrafts({ day });
    console.log(`[Cron] build-ats-outreach${day ? ` (${day})` : ''}: vacancies=${result.vacancies}, created=${result.created}, noContact=${result.noContact}, noCandidates=${result.noCandidates}, existing=${result.existing}`);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron] build-ats-outreach failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
