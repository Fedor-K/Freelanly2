import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isBlogPublishAuthorized } from '@/lib/cron-auth';

/**
 * GET /api/stats/jobs?by=<dimension>&window=<days>&limit=<n>
 * Authorization: Bearer <BLOG_API_KEY>  (CRON_SECRET also accepted)
 *
 * Read-only aggregates over the ingested hiring-post feed, for writing articles that state
 * measured findings. Aggregates ONLY: no titles, descriptions, URLs, recruiter names or anything
 * that could identify a single posting. Groups below MIN_GROUP_SIZE are dropped rather than
 * returned — a group of one is a job ad with extra steps.
 *
 * Determinism: the window is anchored to the top of the current hour, so repeated calls with the
 * same parameters inside an hour return byte-identical numbers without depending on a cache layer.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DIMENSIONS = ['role', 'company', 'country', 'skill', 'month'] as const;
type Dimension = (typeof DIMENSIONS)[number];

const ALLOWED_WINDOWS = [30, 90, 365];
const MIN_GROUP_SIZE = 5;
const MAX_LIMIT = 200;

/** Free mailbox providers are not employers — they would otherwise be the largest "company". */
const FREE_MAIL = "('gmail.com','googlemail.com','yahoo.com','yahoo.co.in','hotmail.com','outlook.com','live.com','aol.com','icloud.com','protonmail.com','mail.com','rediffmail.com','yandex.ru')";

/** Employer identity. posterCompany is empty across the whole table and the Company table was
 *  cleared, so the apply-to domain is the only employer signal we actually hold. */
const DOMAIN = `nullif(lower(split_part(o."applyEmail", '@', 2)), '')`;
const EMPLOYER = `CASE WHEN ${DOMAIN} IN ${FREE_MAIL} THEN NULL ELSE ${DOMAIN} END`;

/** When the role was posted, falling back to ingest time. */
const POSTED = `COALESCE(o."postedAt", o."createdAt")`;

/**
 * Raw titles are unique per posting, so grouping by them yields one group each. This strips, in
 * order: bracketed asides, everything after a separator (usually a location or client name),
 * employment/urgency noise, seniority, then leftover punctuation. Verified against 90 days of live
 * titles: 47,221 of 47,237 normalise, and the top groups come out as "data engineer",
 * "python developer", "qa engineer" — the shape the spec asks for.
 */
const ROLE_RAW = `
nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
  lower(o.title),
  '\\(.*?\\)|\\[.*?\\]|\\{.*?\\}', ' ', 'g'),
  '\\s+[-–—|/:]+\\s+.*$', ' ', 'g'),
  '\\y(urgent|urgently|hiring|immediate|immediately|opening|openings|position|positions|role|roles|job|jobs|vacancy|remote|onsite|on-site|hybrid|contract|contractor|c2c|w2|w-2|corp to corp|fulltime|full time|full-time|part time|part-time|freelance|usa|us|uk|india|only|required|need|needed|looking for|walk in)\\y', ' ', 'g'),
  '\\y(senior|sr|junior|jr|lead|principal|staff|mid|midlevel|mid-level|entry|entry-level|associate|i|ii|iii|iv)\\y', ' ', 'g'),
  '[^a-z0-9+#./ ]', ' ', 'g'
), ' '), '')`;
const ROLE_KEY = `nullif(btrim(regexp_replace(${ROLE_RAW}, '\\s+', ' ', 'g')), '')`;

/**
 * Listings that demand US work authorization — the number this feed can answer and nobody else can:
 * the readership applies to US roles from outside the US, and these postings are closed to them
 * whatever the cover letter says. Read from the stored column: matching the regex over
 * description + originalContent at request time cost ~17s and timed out the skill dimension, so it
 * is evaluated once at ingest (src/lib/us-work-auth.ts) instead.
 */
const US_AUTH = `COALESCE(o."requiresUsWorkAuth", false)`;

/**
 * Median pay is computed over USD-denominated, non-estimated listings only, annualised by period.
 * Mixing currencies would require exchange rates we do not hold, and inventing them would put a
 * fabricated number into print; salaryIsEstimate rows are our own formula output, not observed pay.
 * The sanity band drops parse errors (a "salary" of 40 or of 90,000,000) that would drag a median.
 */
const SALARY_USD = `
CASE WHEN o."salaryCurrency" = 'USD' AND o."salaryIsEstimate" = false AND o."salaryMin" IS NOT NULL THEN
  nullif(
    COALESCE((o."salaryMin" + o."salaryMax") / 2.0, o."salaryMin") *
    CASE o."salaryPeriod"
      WHEN 'HOUR' THEN 2080 WHEN 'DAY' THEN 260 WHEN 'WEEK' THEN 52 WHEN 'MONTH' THEN 12 ELSE 1 END,
  0)
END`;
const SALARY_BANDED = `CASE WHEN (${SALARY_USD}) BETWEEN 5000 AND 1000000 THEN (${SALARY_USD}) END`;

function keyExpression(dim: Dimension): string {
  switch (dim) {
    case 'role': return ROLE_KEY;
    case 'company': return EMPLOYER;
    case 'country': return `nullif(upper(btrim(o.country)), '')`;
    case 'skill': return `nullif(lower(btrim(sk.skill)), '')`;
    case 'month': return `to_char(date_trunc('month', ${POSTED}), 'YYYY-MM')`;
  }
}

type Row = {
  key: string;
  roles_cur: number; roles_prev: number;
  companies_cur: number;
  us_auth_cur: number;
  salary_median: string | null;
  salary_sample: number;
};

export async function GET(req: NextRequest) {
  if (!isBlogPublishAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;

  const byParam = (sp.get('by') || 'role').toLowerCase();
  if (!DIMENSIONS.includes(byParam as Dimension)) {
    // 400, never an empty list: "nothing matched" and "no such dimension" must not look alike.
    return NextResponse.json(
      { error: 'unknown_dimension', dimension: byParam, allowed: DIMENSIONS },
      { status: 400 },
    );
  }
  const dim = byParam as Dimension;

  const windowParam = Number(sp.get('window') || 90);
  if (!ALLOWED_WINDOWS.includes(windowParam)) {
    return NextResponse.json(
      { error: 'unknown_window', window: sp.get('window'), allowed: ALLOWED_WINDOWS },
      { status: 400 },
    );
  }

  const limitParam = Number(sp.get('limit') || 50);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), MAX_LIMIT) : 50;

  try {
    // Anchor everything to the top of the hour so the answer is stable within it.
    const asOf = new Date();
    asOf.setUTCMinutes(0, 0, 0);
    const curStart = new Date(asOf.getTime() - windowParam * 86400_000);
    const prevStart = new Date(asOf.getTime() - 2 * windowParam * 86400_000);

    const [{ earliest }] = await prisma.$queryRaw<{ earliest: Date | null }[]>`
      SELECT min(COALESCE("postedAt", "createdAt")) AS earliest FROM "Opportunity"`;

    // A prior window that starts before the feed does is not a comparison, it is an artefact of when
    // collection began — report null rather than a growth number the data cannot support.
    const priorWindowIsReal = !!earliest && earliest.getTime() <= prevStart.getTime();

    const keyExpr = keyExpression(dim);

    const sql = `
      WITH opp AS (
        SELECT
          ${dim === 'skill' ? 'o.skills' : `${keyExpr} AS key`},
          ${POSTED} AS posted_at,
          ${EMPLOYER} AS employer,
          ${US_AUTH} AS us_auth,
          ${SALARY_BANDED} AS salary_usd
        FROM "Opportunity" o
        WHERE ${POSTED} >= $1 AND ${POSTED} < $3
      ), base AS (
        ${dim === 'skill'
          ? `SELECT nullif(lower(btrim(sk.skill)), '') AS key, posted_at, employer, us_auth, salary_usd
             FROM opp CROSS JOIN LATERAL unnest(skills) AS sk(skill)`
          : `SELECT key, posted_at, employer, us_auth, salary_usd FROM opp`}
      )
      SELECT
        key,
        count(*) FILTER (WHERE posted_at >= $2)::int AS roles_cur,
        count(*) FILTER (WHERE posted_at <  $2)::int AS roles_prev,
        count(DISTINCT employer) FILTER (WHERE posted_at >= $2)::int AS companies_cur,
        count(*) FILTER (WHERE posted_at >= $2 AND us_auth)::int AS us_auth_cur,
        (percentile_cont(0.5) WITHIN GROUP (
            ORDER BY CASE WHEN posted_at >= $2 THEN salary_usd END))::text AS salary_median,
        count(salary_usd) FILTER (WHERE posted_at >= $2)::int AS salary_sample
      FROM base
      WHERE key IS NOT NULL
      GROUP BY key
      HAVING count(*) FILTER (WHERE posted_at >= $2) >= ${MIN_GROUP_SIZE}
      ORDER BY roles_cur DESC, key ASC
      LIMIT ${limit}`;

    const rows = await prisma.$queryRawUnsafe<Row[]>(sql, prevStart, curStart, asOf);

    // Denominators, so a share can be checked rather than trusted.
    const [totals] = await prisma.$queryRawUnsafe<{ total_roles: number; total_roles_prev: number; total_companies: number; suppressed: number }[]>(
      `WITH opp AS (
         SELECT ${dim === 'skill' ? 'o.skills' : `${keyExpr} AS key`}, ${EMPLOYER} AS employer, ${POSTED} AS posted_at
         FROM "Opportunity" o
         WHERE ${POSTED} >= $1 AND ${POSTED} < $3
       ), base AS (
         ${dim === 'skill'
           ? `SELECT nullif(lower(btrim(sk.skill)), '') AS key, employer, posted_at FROM opp CROSS JOIN LATERAL unnest(skills) AS sk(skill)`
           : `SELECT key, employer, posted_at FROM opp`}
       ), cur AS (SELECT * FROM base WHERE posted_at >= $2),
         grouped AS (SELECT key, count(*)::int n FROM cur WHERE key IS NOT NULL GROUP BY key)
       SELECT
         (SELECT count(*)::int FROM cur) AS total_roles,
         (SELECT count(*)::int FROM base WHERE posted_at < $2) AS total_roles_prev,
         (SELECT count(DISTINCT employer)::int FROM cur) AS total_companies,
         (SELECT COALESCE(sum(n), 0)::int FROM grouped WHERE n < ${MIN_GROUP_SIZE}) AS suppressed`,
      prevStart, curStart, asOf,
    );

    const totalRoles = Number(totals?.total_roles ?? 0);
    const totalRolesPrev = Number(totals?.total_roles_prev ?? 0);

    // The feed itself grew: collection ramped from 15,932 listings in the preceding 90 days to
    // 47,237 in the current one. A raw count comparison therefore reports our own scraping ramp as
    // market growth — every group came out between +250% and +700% on the first run, which would
    // have been published as fact. trend_pct compares the group's SHARE of the feed instead, which
    // is invariant to how much we collected; raw counts are exposed as roles/roles_prev alongside
    // it, and feed_growth_pct states the distortion outright.
    const feedGrowthPct = priorWindowIsReal && totalRolesPrev > 0
      ? Number((((totalRoles - totalRolesPrev) / totalRolesPrev) * 100).toFixed(1))
      : null;
    const shareTrend = (cur: number, prev: number): number | null => {
      // A baseline below the group threshold is not a baseline. India went 9 → 1,759 listings
      // between windows purely because the scraper's keyword set changed (an old "NOT India" clause
      // was dropped), which came out as +19,675% — a config change dressed as a market finding.
      // We refuse to publish groups under MIN_GROUP_SIZE; a trend resting on one is worth less.
      if (prev < MIN_GROUP_SIZE) return null;
      if (!priorWindowIsReal || prev <= 0 || totalRoles <= 0 || totalRolesPrev <= 0) return null;
      const curShare = cur / totalRoles;
      const prevShare = prev / totalRolesPrev;
      return prevShare > 0 ? Number((((curShare - prevShare) / prevShare) * 100).toFixed(1)) : null;
    };

    const groups = rows.map((r) => {
      const cur = Number(r.roles_cur);
      const prev = Number(r.roles_prev);
      const sample = Number(r.salary_sample);
      const median = r.salary_median === null ? null : Math.round(Number(r.salary_median));
      return {
        key: r.key,
        roles: cur,
        roles_prev: priorWindowIsReal ? prev : null,
        companies: Number(r.companies_cur),
        share: totalRoles > 0 ? Number((cur / totalRoles).toFixed(4)) : null,
        // Share-relative, not count-relative — see the feed_growth_pct note above.
        // null, not 0: no prior window means not measured, and the two must read differently.
        trend_pct: shareTrend(cur, prev),
        salary_median_usd: sample > 0 ? median : null,
        salary_sample: sample,
        us_work_auth_required: Number(r.us_auth_cur),
      };
    });

    // For month buckets, "the preceding window of equal length" is simply the preceding month.
    if (dim === 'month') {
      // Month buckets ARE the volume series, so here a raw month-over-month count change is the
      // honest number — it is the very quantity that distorts the other dimensions, stated plainly.
      const seen = new Map(groups.map((g) => [g.key, g.roles]));
      for (const g of groups) {
        const [y, m] = g.key.split('-').map(Number);
        const prevKey = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
        const prevRoles = seen.get(prevKey);
        g.trend_pct = prevRoles && prevRoles > 0 ? Number((((g.roles - prevRoles) / prevRoles) * 100).toFixed(1)) : null;
      }
    }

    return NextResponse.json(
      {
        as_of: asOf.toISOString(),
        window_days: windowParam,
        dimension: dim,
        total_roles: totalRoles,
        total_roles_prev: priorWindowIsReal ? totalRolesPrev : null,
        total_companies: Number(totals?.total_companies ?? 0),
        min_group_size: MIN_GROUP_SIZE,
        suppressed_roles: Number(totals?.suppressed ?? 0),
        feed_growth_pct: feedGrowthPct,
        notes: {
          role_key: dim === 'role' ? 'normalised title: seniority, employment type and trailing location stripped' : undefined,
          company_key: dim === 'company' ? 'apply-to email domain; free mailbox providers excluded' : undefined,
          salary_basis: 'median of USD-denominated, non-estimated listings, annualised (hour×2080, day×260, week×52, month×12); other currencies excluded rather than converted at invented rates',
          us_work_auth_required: 'listings whose text demands US work authorization (W2, US citizen, green card, corp-to-corp) and are therefore closed to applicants without it',
          trend_pct: !priorWindowIsReal
            ? 'null throughout: the preceding window starts before the feed does, so there is nothing to compare against'
            : dim === 'month'
              ? 'raw change in listings against the preceding month'
              : "change in this group's SHARE of the feed against the preceding window — NOT a change in raw counts. Collection volume grew between the two windows (see feed_growth_pct), so a raw comparison would report our own scraping ramp as market growth. Raw counts are in roles and roles_prev if you need them.",
          feed_growth_pct: 'change in total listings collected between the two windows. Large values mean the feed itself grew, which is why trend_pct is share-relative.',
          collection_caveat:
            'The search terms behind this feed are edited from time to time — phrases added, dropped, or narrowed by country — and the collectors were consolidated in August 2026. Share-relative trend_pct removes the effect of collecting MORE, but nothing can remove the effect of collecting DIFFERENTLY: if a term stopped excluding a country, that country appears to surge. Trends within one window are sound; trends across a configuration change are directional at best. A group whose baseline is under ' +
            `${MIN_GROUP_SIZE} listings returns null instead of a number for this reason.`,
          suppressed_roles: `listings in groups smaller than ${MIN_GROUP_SIZE}, counted in total_roles but not returned as groups`,
        },
        groups,
      },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=600' } },
    );
  } catch (error) {
    console.error('[Stats/Jobs] Error:', error);
    return NextResponse.json({ error: 'Failed to compute stats' }, { status: 500 });
  }
}
