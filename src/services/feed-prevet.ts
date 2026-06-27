// Background pre-vet for the discovery feed (runs on the Hetzner worker via cron — LLM-heavy, never
// on the feed render path). Warms the per-user gate-verdict cache (MatchVerdict) for each active feed
// user's TOP candidates, so the feed's CACHE-ONLY getVerdicts (src/app/dashboard/discovery/page.tsx)
// has a real verdict for every shown card — and drops the ones the apply-gate would refuse BEFORE the
// user clicks. This closes the gap cache-only alone can't: NOVEL pairs the auto-apply matcher never
// evaluated (ATS/applyUrl roles, manual-mode users) which otherwise surface as a first-click poor_match.
import { prisma } from '@/lib/db';
import { buildFitContext, scoreFitLabeled, type FitLabel } from '@/lib/fit-score';
import { getVerdicts } from '@/lib/match-verdict';

const RANK: Record<FitLabel, number> = { Strong: 0, Good: 1, Weak: 2 };

/**
 * Pre-vet the discovery feed for the recent feed audience. Bounded + cache-first: getVerdicts reuses
 * MatchVerdict + the matcher's verdicts and only spends an LLM call on a genuinely-novel pair, so
 * repeat runs are cheap and steady-state cost is just "new opportunities × active feed users".
 */
export async function prevetFeed(opts: { maxUsers?: number; perUser?: number } = {}): Promise<{ users: number; vetted: number }> {
  const maxUsers = opts.maxUsers ?? Number(process.env.FEED_PREVET_MAX_USERS || 30);
  const perUser = opts.perUser ?? Number(process.env.FEED_PREVET_PER_USER || 10);
  const since = new Date(Date.now() - 3 * 86400000);

  // Audience = users who actually touched Discovery in the last 3 days (viewed OR clicked apply in the
  // feed) AND have a résumé to match on. Small, targeted set → no rotation bookkeeping needed.
  const audience = await prisma.$queryRaw<{ userId: string }[]>`
    SELECT DISTINCT a."userId"
    FROM "ActivityLog" a
    JOIN "User" u ON u.id = a."userId"
    WHERE a."createdAt" >= ${since}
      AND u."resumeUrl" IS NOT NULL
      AND a."userId" IS NOT NULL
      AND (
        (a.action = 'PAGE_VIEW' AND a."pageUrl" ILIKE '%discovery%')
        OR (a.action = 'OPPORTUNITY_APPLY_CLICK' AND a.details->>'method' = 'feed')
      )
    LIMIT ${maxUsers}`;
  if (!audience.length) return { users: 0, vetted: 0 };

  // The 7-day feed pool, fetched ONCE and scored per user (same source/shape as the live feed).
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const pool = await prisma.opportunity.findMany({
    where: { isActive: true, createdAt: { gte: weekAgo }, OR: [{ applyEmail: { not: null } }, { applyUrl: { not: null } }] },
    select: { id: true, title: true, skills: true, description: true },
  });
  if (!pool.length) return { users: audience.length, vetted: 0 };

  let vetted = 0;
  for (const { userId } of audience) {
    try {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, parsedProfile: true, resumeText: true, resumeUrl: true },
      });
      if (!u) continue;
      const ctx = buildFitContext(u.parsedProfile as Record<string, unknown> | null);
      if (ctx.empty) continue;
      // Top-K Good+ candidates for this user — the same ranking the feed's closest tail uses.
      const top = pool
        .map((o) => ({ o, fit: scoreFitLabeled(ctx, { title: o.title, skills: o.skills }) }))
        .filter((x) => x.fit.label !== 'Weak')
        .sort((a, b) => (RANK[a.fit.label] - RANK[b.fit.label]) || (b.fit.score - a.fit.score))
        .slice(0, perUser)
        .map((x) => ({ id: x.o.id, title: x.o.title, description: x.o.description }));
      if (!top.length) continue;
      // FULL vet (LLM only for the gaps) → writes MatchVerdict, which the feed reads cache-only.
      const v = await getVerdicts(
        { id: u.id, parsedProfile: u.parsedProfile as Record<string, unknown> | null, resumeText: u.resumeText, resumeUrl: u.resumeUrl },
        top,
      );
      vetted += v.size;
    } catch (e) {
      console.error(`[prevet] user ${userId} failed:`, (e as Error)?.message);
    }
  }
  return { users: audience.length, vetted };
}
