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

  const runs: Array<{
    actId: string; startedAt: string; usageTotalUsd?: number; status: string;
    meta?: { origin?: string }; defaultKeyValueStoreId?: string;
  }> = [];
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

  // ?attribute=1 — classify every post-search run in the window by its INPUT signature and split
  // spend per caller. The token is account-wide and several products bill through it; run metadata
  // can't tell them apart (everything is origin=API), but the input shape can:
  //   · freelanly's n8n cycles send ONE query per run with maxPosts=2000
  //     (boolean-style query → Spheres; short stack phrase → the QA/.NET/Python/React workflows)
  //   · other products send query BATCHES with small maxPosts (100/40)
  const attribute = request.nextUrl.searchParams.get('attribute') === '1';
  let byCaller: Record<string, { runs: number; usd: number }> = {};
  let byCallerDay: Record<string, Record<string, number>> = {};
  const byCallerDayRuns: Record<string, Record<string, number>> = {};
  const externalQueries: Record<string, { runs: number; usd: number }> = {};
  if (attribute) {
    // Resolve which actId is the post-search actor (name lookup happens below too, but we need it now)
    const ids = [...new Set(win.map((r) => r.actId))];
    const idName: Record<string, string> = {};
    for (const id of ids) {
      const act = await fetch(`https://api.apify.com/v2/acts/${id}?token=${token}`)
        .then((r) => r.json()).catch(() => null);
      idName[id] = act?.data?.name || id;
    }
    const searchRuns = win.filter((r) => (idName[r.actId] || '').includes('post-search'));
    // Query COUNT is the reliable splitter: every n8n workflow here sends exactly one query per
    // run (Spheres with maxPosts=2000, stack workflows with a smaller cap); external callers send
    // batches. maxPosts alone misclassified the stack workflows on the first pass.
    const classify = (input: { searchQueries?: string[]; maxPosts?: number } | null): string => {
      if (!input) return 'unknown';
      const qs = input.searchQueries ?? [];
      if (qs.length === 1)
        return /["()]| AND | OR | NOT /.test(qs[0]) ? 'freelanly-spheres' : 'freelanly-stacks';
      return 'external';
    };
    const POOL = 25;
    for (let i = 0; i < searchRuns.length; i += POOL) {
      const chunk = searchRuns.slice(i, i + POOL);
      const inputs = await Promise.all(
        chunk.map((r) =>
          fetch(`https://api.apify.com/v2/key-value-stores/${r.defaultKeyValueStoreId}/records/INPUT?token=${token}`)
            .then((res) => res.json()).catch(() => null)
        )
      );
      chunk.forEach((r, j) => {
        const caller = classify(inputs[j]);
        const usd = r.usageTotalUsd ?? 0;
        (byCaller[caller] ??= { runs: 0, usd: 0 }).runs++;
        byCaller[caller].usd += usd;
        const day = r.startedAt.slice(0, 10);
        const cd = (byCallerDay[caller] ??= {});
        cd[day] = Math.round(((cd[day] ?? 0) + usd) * 100) / 100;
        const cr = (byCallerDayRuns[caller] ??= {});
        cr[day] = (cr[day] ?? 0) + 1;
        if (caller === 'external' || caller === 'freelanly-stacks') {
          const key = `${caller}: ` + (inputs[j]?.searchQueries ?? []).slice(0, 3).join(' | ');
          (externalQueries[key] ??= { runs: 0, usd: 0 }).runs++;
          externalQueries[key].usd += usd;
        }
      });
    }
    byCaller = Object.fromEntries(
      Object.entries(byCaller).map(([k, v]) => [k, { runs: v.runs, usd: Math.round(v.usd * 100) / 100 }])
    );
  }

  // ?sampleInputs=N — fetch the INPUT of the N most expensive runs in the window. searchQueries
  // identify the CALLER (freelanly's n8n query cycles vs other products on the same Apify account),
  // which run metadata alone cannot do — every caller shows origin=API.
  const sampleN = Math.min(40, parseInt(request.nextUrl.searchParams.get('sampleInputs') || '0', 10) || 0);
  let samples: Array<Record<string, unknown>> = [];
  if (sampleN > 0) {
    const picked = [...win]
      .sort((a, b) => (b.usageTotalUsd ?? 0) - (a.usageTotalUsd ?? 0))
      .slice(0, sampleN);
    samples = await Promise.all(
      picked.map(async (r) => {
        const input = await fetch(
          `https://api.apify.com/v2/key-value-stores/${r.defaultKeyValueStoreId}/records/INPUT?token=${token}`
        ).then((res) => res.json()).catch(() => null);
        return {
          startedAt: r.startedAt,
          usd: Math.round((r.usageTotalUsd ?? 0) * 100) / 100,
          queries: input?.searchQueries ?? input?.queries ?? null,
          maxPosts: input?.maxPosts ?? null,
          postedLimit: input?.postedLimit ?? null,
          scrapePages: input?.scrapePages ?? null,
        };
      })
    );
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
    ...(samples.length ? { samples } : {}),
    ...(attribute
      ? {
          byCaller,
          byCallerDay,
          byCallerDayRuns,
          topNonSpheresQueries: Object.entries(externalQueries)
            .map(([q, v]) => ({ q, runs: v.runs, usd: Math.round(v.usd * 100) / 100 }))
            .sort((a, b) => b.usd - a.usd)
            .slice(0, 20),
        }
      : {}),
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
