import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';
import { buildLeverCompanyCards } from '@/services/sources/lever-pipeline';
import { buildShortlistForRole } from '@/services/recruiter-shortlist';
import { sendCompanyCard, OUTREACH } from '@/services/sources/recruiter-outreach';

/**
 * Demand-side: for each Lever company with fresh target roles + a resolvable contact, build a vetted
 * shortlist and (if enabled) email the company a candidate card. Fully guarded by recruiter-outreach.ts
 * (OUTREACH_ENABLED=false by default → no-op dry run that still builds cards/shortlists for inspection).
 *
 * ⚠️ HETZNER-ONLY: resolveCompanyContact does a port-25 SMTP probe (blocked on Vercel) — NOT in
 * vercel.json; trigger from the worker via Bearer CRON_SECRET. On Vercel it degrades to 0 contacts.
 * Before real sends: isolated Postal domain (OUTREACH_FROM_EMAIL) + candidate consent. See plan.
 */
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ skipped: true, reason: 'non-production deployment' });
  }
  try {
    const limit = parseInt(new URL(request.url).searchParams.get('limit') || '25') || 25;
    const cards = await buildLeverCompanyCards({ limit, requireContact: true });

    let sent = 0, dryRun = 0, noCandidates = 0;
    const blockedReasons: Record<string, number> = {};
    const samples: Array<{ company: string; role: string; candidates: number; result: string }> = [];

    for (const card of cards) {
      const shortlist = await buildShortlistForRole(card.roles[0], { limit: 3 });
      if (!shortlist.length) { noCandidates++; continue; }
      const res = await sendCompanyCard(card, shortlist);
      if (res.sent) sent++;
      else { dryRun++; blockedReasons[res.reason] = (blockedReasons[res.reason] || 0) + 1; }
      if (samples.length < 10) samples.push({ company: card.name || card.contact.domain, role: card.roles[0].title, candidates: shortlist.length, result: res.sent ? 'sent' : res.reason });
    }

    console.log(`[Cron] recruiter-outreach: ${cards.length} cards, sent=${sent}, blocked/dry=${dryRun}, noCandidates=${noCandidates}, enabled=${OUTREACH.enabled}`);
    return NextResponse.json({ success: true, enabled: OUTREACH.enabled, companies: cards.length, sent, dryRun, noCandidates, blockedReasons, samples });
  } catch (error) {
    console.error('[Cron] recruiter-outreach failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
