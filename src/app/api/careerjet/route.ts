import { NextRequest, NextResponse } from 'next/server';
import { fetchCareerjetJobs, fetchAdzunaJobs, interleaveJobs } from '@/lib/careerjet';

/**
 * GET /api/careerjet?keywords=<terms>&page_size=<n>
 *
 * Returns Careerjet CPC jobs for the CURRENT visitor — their real IP / geo / user-agent come from THIS
 * request's headers (the browser hit this route, so x-forwarded-for is the visitor, not our server).
 * Client feeds call this and interleave the results as "Sponsored" cards; a click on a job's tracking
 * url is a billable CPC event credited to our Careerjet publisher account.
 *
 * Best-effort: any failure returns an empty list, so the feed just shows our own opportunities.
 */

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const keywords = (sp.get('keywords') || '').slice(0, 120).trim();
  if (!keywords) return NextResponse.json({ jobs: [] });

  const pageSize = Math.min(Math.max(Number(sp.get('page_size')) || 6, 1), 12);

  // Same header-reading pattern as /api/track: real visitor IP + country off Vercel/Cloudflare headers.
  const fwd = request.headers.get('x-forwarded-for');
  const userIp = fwd
    ? fwd.split(',')[0].trim()
    : (request.headers.get('x-real-ip') || request.headers.get('cf-connecting-ip') || '');
  const userAgent = request.headers.get('user-agent') || '';
  const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || null;
  // Careerjet requires a Referer on the same domain as the publisher account. Prefer the page the user
  // is on; fall back to our own domain.
  const referer = request.headers.get('referer') || 'https://freelanly.com/remote-jobs';

  // Careerjet's click-tracking (jobviewtrack.com) was down (502) for the first ~24h after launch, so we
  // gated it out. It recovered 2026-08-31 — real tracking links now 302 to careerjet.com/clk/...?affid=
  // (our billable attribution) and land on the job — so Careerjet is enabled by default and rejoins the
  // interleave. Kill switch: set CAREERJET_ENABLED=0 to suppress it again if its tracking breaks.
  const careerjetEnabled = process.env.CAREERJET_ENABLED !== '0';

  // CPC sources fetched in parallel and interleaved. Adzuna leads (its click-throughs work for real
  // users); Careerjet fills when healthy. Either returning empty just leaves the other's jobs.
  const [adzuna, careerjet] = await Promise.all([
    fetchAdzunaJobs({ keywords, country, pageSize }),
    careerjetEnabled
      ? fetchCareerjetJobs({ keywords, country, userIp, userAgent, referer, pageSize })
      : Promise.resolve([]),
  ]);
  const jobs = interleaveJobs(adzuna, careerjet);
  return NextResponse.json({ jobs, country }, { headers: { 'Cache-Control': 'no-store' } });
}
