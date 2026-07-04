// Vetted-only feed engine (two-stage): the feed renders ONLY pairs the real AI gate approved.
// Trigger is user arrival (the client polls /api/user/feed-vet while the feed is open), so cost is
// strictly per actual visit: a daily visitor re-vets only the delta since yesterday (verdict cache
// lives 14d), a newcomer gets his direction pool vetted progressively during the intro screen.
//
// Stage 1 (free, ms): pool = the user's DIRECTION over the last FEED_POOL_DAYS, pre-cut by the local
//   qwen embedding similarity (calibrated 2026-07-04 on 3,960 labeled gate verdicts: sim>=0.45 keeps
//   95% of SENDs and cuts ~22% of NOs — embeddings see topic, not profession, so the cut is modest).
// Stage 2 ($, ~7s/pair): the SAME assessPairing gate as apply/matcher, via getVerdicts (cached,
//   never stores fail-open). Vetting order = lexical score desc, so the best candidates land first.

import { prisma } from '@/lib/db';
import { buildFitContext, scoreFitLabeled } from '@/lib/fit-score';
import { getVerdicts } from '@/lib/match-verdict';
import { deriveCategorySlugs } from '@/lib/loop-routing';
import { buildGateEvidence, verifiedSkillsFor, type ReviewRow } from '@/lib/github-review/evidence';

const POOL_DAYS = Number(process.env.FEED_POOL_DAYS || 5);
const STAGE1_SIM_MIN = Number(process.env.STAGE1_SIM_MIN || 0.45);
const DAILY_VET_CAP = Number(process.env.FEED_VET_DAILY_CAP || 20000);
const DEV_LIKE = new Set(['engineering', 'devops', 'data', 'qa', 'security', 'design', 'product', 'marketing', 'sales', 'finance', 'hr', 'operations', 'legal', 'project-management', 'writing', 'translation', 'creative', 'support', 'education', 'research', 'consulting']);

export type FeedVetStatus = {
  poolSize: number;      // direction pool after stage-1
  vetted: number;        // pairs with a verdict (any decision)
  approved: number;      // pairs with SEND
  remaining: number;     // pairs still needing the LLM gate
  vettedNow: number;     // how many this call processed
  budgetExhausted: boolean;
};

type PoolRow = { id: string; title: string; skills: string[]; sim: number | null };

/** The user's direction pool with per-pair cosine sim computed in SQL (embeddings live outside
 *  the Prisma schema — raw query). Uncategorized opportunities are kept (they'd otherwise vanish
 *  for everyone); stage-1 cuts them by sim/lex like the rest. */
async function directionPool(userId: string, slugs: string[]): Promise<PoolRow[]> {
  const since = new Date(Date.now() - POOL_DAYS * 864e5);
  const slugList = slugs.filter(s => DEV_LIKE.has(s));
  return prisma.$queryRaw<PoolRow[]>`
    SELECT o.id, o.title, o.skills,
      CASE WHEN o.embedding IS NOT NULL AND u.embedding IS NOT NULL
           THEN 1 - (o.embedding <=> u.embedding) ELSE NULL END AS sim
    FROM "Opportunity" o
    LEFT JOIN "Category" c ON c.id = o."categoryId"
    CROSS JOIN (SELECT embedding FROM "User" WHERE id = ${userId}) u
    WHERE o."isActive" = true
      AND o."createdAt" >= ${since}
      AND (o."applyEmail" IS NOT NULL OR o."applyUrl" IS NOT NULL)
      AND (c.slug = ANY(${slugList}::text[]) OR o."categoryId" IS NULL)
  `;
}

/** Stage-1: free pre-cut. Keep a pair when the embedding says "close enough" (calibrated threshold),
 *  or when there is no embedding yet (fail-open: a just-ingested opp must not be invisible), or when
 *  the lexical label is non-Weak (profession/skill overlap the embedding may miss). */
function stage1Keep(row: PoolRow, lexLabel: string): boolean {
  if (row.sim === null) return lexLabel !== 'Weak';
  if (row.sim >= STAGE1_SIM_MIN) return true;
  return lexLabel !== 'Weak';
}

async function todaysVetCount(): Promise<number> {
  const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
  return prisma.matchVerdict.count({ where: { createdAt: { gte: dayStart } } });
}

type VetUserRow = {
  id: string; parsedProfile: unknown; resumeText: string | null; resumeUrl: string | null;
  githubUrl: string | null; githubReview: ReviewRow | null;
};

type VetState = {
  user: VetUserRow;
  ghUser: { githubUrl: string | null; parsedProfile: unknown };
  ghReview: ReviewRow | null;
  // stage-1-surviving pool, best lexical score first
  pool: Array<{ r: PoolRow; f: ReturnType<typeof scoreFitLabeled> }>;
  verdict: Map<string, string>; // opportunityId → 'SEND' | 'NO'
};

/** Shared state builder: direction pool → stage-1 cut → existing verdicts (all three sources, same
 *  precedence the feed render uses). Read-only — no LLM calls. */
async function computeVetState(userId: string): Promise<VetState | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, parsedProfile: true, resumeText: true, resumeUrl: true,
      githubUrl: true, githubReview: { select: { verdict: true, report: true, profileStamp: true, reviewedAt: true } },
    },
  });
  if (!user?.parsedProfile) return null;
  const pp = user.parsedProfile as Record<string, unknown>;
  const slugs = deriveCategorySlugs({
    currentTitle: typeof pp.current_title === 'string' ? pp.current_title : null,
    field: typeof pp.field === 'string' ? pp.field : null,
    skills: Array.isArray(pp.skills) ? (pp.skills as unknown[]).map(String) : [],
  });
  const ghUser = { githubUrl: user.githubUrl, parsedProfile: user.parsedProfile };
  const ghReview = (user.githubReview as ReviewRow | null) ?? null;
  const ctx = buildFitContext(pp, verifiedSkillsFor(ghUser, ghReview));
  if (ctx.empty) return null;

  const rawPool = await directionPool(userId, slugs.length ? slugs : ['engineering']);
  const scored = rawPool.map(r => ({ r, f: scoreFitLabeled(ctx, { title: r.title, skills: r.skills }, r.sim ?? undefined) }));
  const pool = scored.filter(x => stage1Keep(x.r, x.f.label)).sort((a, b) => b.f.score - a.f.score);

  const ids = pool.map(x => x.r.id);
  const verdict = new Map<string, string>();
  if (ids.length) {
    const [mv, pv, aa] = await Promise.all([
      prisma.matchVerdict.findMany({ where: { userId, opportunityId: { in: ids } }, select: { opportunityId: true, decision: true } }),
      prisma.pairingVerdict.findMany({ where: { userId, opportunityId: { in: ids } }, select: { opportunityId: true, decision: true } }),
      prisma.autoApplication.findMany({ where: { userId, opportunityId: { in: ids }, matchLabel: { not: null } }, select: { opportunityId: true, status: true } }),
    ]);
    for (const a of aa) verdict.set(a.opportunityId!, a.status === 'MATCH_REJECTED' ? 'NO' : 'SEND');
    for (const v of pv) verdict.set(v.opportunityId, v.decision);
    for (const v of mv) verdict.set(v.opportunityId, v.decision);
  }
  return { user: user as VetUserRow, ghUser, ghReview, pool, verdict };
}

/** Read-only view for the feed render: approved opportunity ids in score order + coverage counters. */
export async function readVettedFeed(userId: string): Promise<{
  approvedIds: string[];
  fits: Map<string, ReturnType<typeof scoreFitLabeled>>;
  status: Omit<FeedVetStatus, 'vettedNow' | 'budgetExhausted'>;
} | null> {
  const st = await computeVetState(userId);
  if (!st) return null;
  const approved = st.pool.filter(x => st.verdict.get(x.r.id) === 'SEND');
  const vetted = st.pool.filter(x => st.verdict.has(x.r.id)).length;
  return {
    approvedIds: approved.map(x => x.r.id),
    fits: new Map(st.pool.map(x => [x.r.id, x.f])),
    status: { poolSize: st.pool.length, vetted, approved: approved.length, remaining: st.pool.length - vetted },
  };
}

/** One vetting slice for this user: vets up to `maxPairs` of the pool's verdict-less pairs (best
 *  lexical score first), returns coverage. Called repeatedly by the client while the feed is open —
 *  first calls fill a fresh feed, later calls pick up newly-ingested opportunities. */
export async function runFeedVetSlice(userId: string, maxPairs = 24): Promise<FeedVetStatus | null> {
  const st = await computeVetState(userId);
  if (!st) return null;
  const { user, ghUser, ghReview, pool, verdict } = st;
  const pp = user.parsedProfile as Record<string, unknown>;
  const ids = pool.map(x => x.r.id);
  if (!ids.length) return { poolSize: 0, vetted: 0, approved: 0, remaining: 0, vettedNow: 0, budgetExhausted: false };

  const missing = pool.filter(x => !verdict.has(x.r.id));
  let vettedNow = 0;
  let budgetExhausted = false;

  if (missing.length && maxPairs > 0) {
    const spentToday = await todaysVetCount();
    const budgetLeft = Math.max(0, DAILY_VET_CAP - spentToday);
    const take = Math.min(maxPairs, budgetLeft, missing.length);
    if (take === 0 && missing.length) budgetExhausted = budgetLeft === 0;
    if (take > 0) {
      const batchIds = missing.slice(0, take).map(x => x.r.id);
      const full = await prisma.opportunity.findMany({
        where: { id: { in: batchIds } },
        select: { id: true, title: true, description: true },
      });
      const v = await getVerdicts(
        {
          id: user.id, parsedProfile: pp, resumeText: user.resumeText, resumeUrl: user.resumeUrl,
          githubEvidence: buildGateEvidence(ghUser, ghReview),
        },
        full,
      );
      for (const [oid, r] of v) { verdict.set(oid, r.decision); vettedNow++; }
    }
  }

  const vetted = ids.filter(i => verdict.has(i)).length;
  const approved = ids.filter(i => verdict.get(i) === 'SEND').length;
  return { poolSize: ids.length, vetted, approved, remaining: ids.length - vetted, vettedNow, budgetExhausted };
}
