import { NextRequest, NextResponse } from 'next/server';
import { checkCronSecret } from '@/lib/admin-auth';

/**
 * GET/POST /api/cron/apify-report?since=2026-08-05  (default: last 7 days)
 *
 * Apify spend for a window, split by actor and by day — the server-side twin of
 * `npm run metrics apify` (scripts/metrics.ts), which can't run locally without the
 * token. Sums usageTotalUsd over actor-runs; pagination must go deep — the profile
 * scraper alone does thousands of runs a week, and a shallow cap silently
 * understates the bill (see the 2026-08-05 audit).
 */
const PAGE = 1000;
const MAX_OFFSET = 40000;

export async function GET(request: NextRequest) {
  const authError = checkCronSecret(request);
  if (authError) return authError;

  const token = (process.env.APIFY_API_TOKEN || '').trim();
  if (!token) return NextResponse.json({ error: 'APIFY_API_TOKEN not configured' }, { status: 500 });

  const sinceParam = request.nextUrl.searchParams.get('since');
  const since = sinceParam ? new Date(sinceParam) : new Date(Date.now() - 7 * 86400_000);
  if (isNaN(since.getTime())) return NextResponse.json({ error: 'bad since' }, { status: 400 });

  const runs: Array<{ actId: string; startedAt: string; usageTotalUsd?: number; status: string; meta?: { origin?: string } }> = [];
  for (let offset = 0; offset < MAX_OFFSET; offset += PAGE) {
    const page = await fetch(
      `https://api.apify.com/v2/actor-runs?token=${token}&desc=1&limit=${PAGE}&offset=${offset}`
    ).then((r) => r.json()).catch(() => null);
    const items = page?.data?.items ?? [];
    runs.push(...items);
    const oldest = items[items.length - 1]?.startedAt;
    if (items.length < PAGE || !oldest || new Date(oldest).getTime() < since.getTime()) break;
  }

  const win = runs.filter((r) => new Date(r.startedAt).getTime() >= since.getTime());
  const byActor: Record<string, { runs: number; usd: number }> = {};
  const byDay: Record<string, { runs: number; usd: number }> = {};
  // origin tells WHO started the run (API = external caller like n8n/app, SCHEDULER = a schedule
  // configured inside Apify, WEB = console button) — the only way to see Apify-side schedules here.
  const byOrigin: Record<string, Record<string, { runs: number; usd: number }>> = {};
  let totalUsd = 0;
  for (const r of win) {
    const usd = r.usageTotalUsd ?? 0;
    totalUsd += usd;
    (byActor[r.actId] ??= { runs: 0, usd: 0 }).runs++;
    byActor[r.actId].usd += usd;
    const day = r.startedAt.slice(0, 10);
    (byDay[day] ??= { runs: 0, usd: 0 }).runs++;
    byDay[day].usd += usd;
    const origin = r.meta?.origin || '?';
    const o = ((byOrigin[r.actId] ??= {})[origin] ??= { runs: 0, usd: 0 });
    o.runs++;
    o.usd += usd;
  }

  // Resolve actor names (a handful of distinct ids)
  const names: Record<string, string> = {};
  for (const id of Object.keys(byActor)) {
    const act = await fetch(`https://api.apify.com/v2/acts/${id}?token=${token}`)
      .then((r) => r.json()).catch(() => null);
    names[id] = act?.data?.name ? `${act.data.username ?? ''}/${act.data.name}` : id;
  }

  return NextResponse.json({
    since: since.toISOString(),
    truncated: runs.length >= MAX_OFFSET,
    totalRuns: win.length,
    totalUsd: Math.round(totalUsd * 100) / 100,
    perDayUsd: Math.round((totalUsd / Math.max(1, (Date.now() - since.getTime()) / 86400_000)) * 100) / 100,
    byActor: Object.entries(byActor)
      .map(([id, v]) => ({ actor: names[id], runs: v.runs, usd: Math.round(v.usd * 100) / 100 }))
      .sort((a, b) => b.usd - a.usd),
    byOrigin: Object.entries(byOrigin).map(([id, origins]) => ({
      actor: names[id],
      origins: Object.fromEntries(
        Object.entries(origins).map(([o, v]) => [o, { runs: v.runs, usd: Math.round(v.usd * 100) / 100 }])
      ),
    })),
    byDay: Object.entries(byDay)
      .map(([day, v]) => ({ day, runs: v.runs, usd: Math.round(v.usd * 100) / 100 }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
