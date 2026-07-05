import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';
import { buildOutreachDrafts } from '@/services/sources/outreach-drafts';

/**
 * Build (not send) demand-side outreach drafts: run the Lever pipeline and persist one ready-to-send
 * candidate-pitch email per (company, role) into OutreachDraft. The founder reviews + sends them
 * manually from /admin/recruiter-outreach — this endpoint never emails anyone.
 *
 * ⚠️ Run from the Hetzner worker (Bearer CRON_SECRET): resolveCompanyContact wants port 25 for a
 * verified contact; on a host without it, set CONTACT_PROBE_ENABLED=false and it drafts with a
 * careers@ guess. Heavy (fetches many Lever boards + LLM shortlist) — up to 5 min.
 */
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '2060') || 2060;
    const randomize = url.searchParams.get('randomize') === '1' || url.searchParams.get('randomize') === 'true';
    const result = await buildOutreachDrafts({ limit, randomize });
    console.log(`[Cron] build-outreach: companies=${result.companies}, created=${result.created}, existing=${result.existing}, noCandidates=${result.noCandidates}`);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron] build-outreach failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
