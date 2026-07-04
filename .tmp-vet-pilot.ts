import { PrismaClient } from '@prisma/client';
import { buildFitContext, scoreFitLabeled } from './src/lib/fit-score';
import { getVerdicts } from './src/lib/match-verdict';
import { buildGateEvidence, type ReviewRow } from './src/lib/github-review/evidence';

const p = new PrismaClient();
async function main() {
  const users = await p.$queryRawUnsafe<{ id: string }[]>(`
    SELECT DISTINCT a."userId" as id FROM "ActivityLog" a JOIN "User" u ON u.id = a."userId"
    WHERE a."createdAt" >= NOW() - INTERVAL '2 days' AND a.action='PAGE_VIEW' AND a."pageUrl" ILIKE '%discovery%'
      AND u."parsedProfile" IS NOT NULL LIMIT 30`);
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const pool = await p.opportunity.findMany({
    where: { isActive: true, createdAt: { gte: weekAgo }, OR: [{ applyEmail: { not: null } }, { applyUrl: { not: null } }] },
    select: { id: true, title: true, skills: true },
  });
  let done = 0, yesTotal: number[] = [];
  for (const { id } of users) {
    const u = await p.user.findUnique({ where: { id }, select: { id: true, parsedProfile: true, resumeText: true, resumeUrl: true, githubUrl: true, githubReview: { select: { verdict: true, report: true, profileStamp: true, reviewedAt: true } } } });
    if (!u) continue;
    const ctx = buildFitContext(u.parsedProfile as Record<string, unknown> | null);
    if (ctx.empty) continue;
    const top = pool.map(o => ({ o, f: scoreFitLabeled(ctx, { title: o.title, skills: o.skills }) }))
      .filter(x => x.f.label !== 'Weak').sort((a, b) => b.f.score - a.f.score).slice(0, 50);
    if (!top.length) continue;
    const full = await p.opportunity.findMany({ where: { id: { in: top.map(x => x.o.id) } }, select: { id: true, title: true, description: true } });
    const gh = buildGateEvidence({ githubUrl: u.githubUrl, parsedProfile: u.parsedProfile }, (u.githubReview as ReviewRow | null) ?? null);
    let yes = 0;
    for (let i = 0; i < full.length; i += 10) {
      const v = await getVerdicts(
        { id: u.id, parsedProfile: u.parsedProfile as Record<string, unknown> | null, resumeText: u.resumeText, resumeUrl: u.resumeUrl, githubEvidence: gh },
        full.slice(i, i + 10),
      );
      for (const [, r] of v) if (r.decision === 'SEND') yes++;
    }
    yesTotal.push(yes);
    done++;
    console.log(`[${done}/30] user ${id}: ${yes} YES of ${full.length} vetted`);
  }
  yesTotal.sort((a, b) => a - b);
  const pct = (q: number) => yesTotal[Math.min(yesTotal.length - 1, Math.floor(q * yesTotal.length))];
  console.log('HONEST FEED THICKNESS (YES of top-50): p10', pct(.1), 'p50', pct(.5), 'p90', pct(.9));
}
main().finally(() => p.$disconnect());
