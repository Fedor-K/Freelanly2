// Shared per-(candidate × opportunity) LLM verdict cache.
//
// ONE assessPairing vet per pair, reused everywhere:
//   1. MatchVerdict cache (this module's own writes) — instant.
//   2. existing AutoApplication.matchLabel — the auto-apply matcher already vetted it → free.
//   3. otherwise assessPairing() ONCE, then cache in MatchVerdict so it's never recomputed.
//
// The discovery feed calls this synchronously for its top-K strong-lexical candidates only, so the
// landing shows real (not lexical) Strong labels without re-running work the matcher already did.
import { prisma } from '@/lib/db';
import { assessPairing } from '@/services/matching/assess-pairing';
import { hasRealCV } from '@/lib/resume-attachment';

export type Verdict = { label: 'Strong' | 'Good' | 'Weak'; decision: 'NO' | 'SEND' };

type VetUser = {
  id: string;
  parsedProfile: Record<string, unknown> | null;
  resumeText: string | null;
  resumeUrl: string | null;
  // optional pre-built GitHub gate-evidence line (buildGateEvidence) — corroborating-only
  githubEvidence?: string | null;
};

type VetOpp = { id: string; title: string; description: string };

/**
 * Real LLM verdicts for these (user × opportunity) pairs. Reads the shared cache first, vets only the
 * gaps via assessPairing (in parallel), and caches them. Bounded to the opps passed in. Pairs whose
 * vet fails-open (no label) are simply absent from the result → caller keeps its lexical fallback.
 */
export async function getVerdicts(
  user: VetUser,
  opps: VetOpp[],
  opts: { cacheOnly?: boolean } = {},
): Promise<Map<string, Verdict>> {
  const out = new Map<string, Verdict>();
  if (!opps.length) return out;
  const ids = opps.map((o) => o.id);

  // 1. our own verdict cache
  const cached = await prisma.matchVerdict.findMany({
    where: { userId: user.id, opportunityId: { in: ids } },
    select: { opportunityId: true, label: true, decision: true },
  });
  for (const c of cached) out.set(c.opportunityId, { label: c.label as Verdict['label'], decision: c.decision as Verdict['decision'] });

  // 2. reuse the auto-apply matcher's already-computed verdicts (free)
  const need1 = ids.filter((id) => !out.has(id));
  if (need1.length) {
    const apps = await prisma.autoApplication.findMany({
      where: { userId: user.id, opportunityId: { in: need1 }, matchLabel: { not: null } },
      select: { opportunityId: true, matchLabel: true, status: true },
    });
    for (const a of apps) {
      if (!a.opportunityId || !a.matchLabel) continue;
      out.set(a.opportunityId, {
        label: a.matchLabel as Verdict['label'],
        decision: a.status === 'MATCH_REJECTED' ? 'NO' : 'SEND',
      });
    }
  }

  // 3. vet the rest once, in parallel, then cache. SKIPPED in cacheOnly mode — callers on a latency-
  // sensitive path (the discovery feed render) reuse only the free cached/matcher verdicts and leave
  // novel pairs to their lexical fallback (the first apply-click then caches a real verdict).
  const need2 = opts.cacheOnly ? [] : opps.filter((o) => !out.has(o.id));
  if (need2.length) {
    const profile = user.parsedProfile;
    const cvText = user.resumeText || '';
    const realCv = hasRealCV(user);
    const results = await Promise.all(
      need2.map(async (o) => ({
        o,
        r: await assessPairing({ jobTitle: o.title, jobDescription: o.description, jobCountry: null, profile, cvText, hasRealCV: realCv, githubEvidence: user.githubEvidence ?? null }),
      })),
    );
    const toWrite = [];
    for (const { o, r } of results) {
      if (!r.label) continue; // fail-open → leave to lexical fallback, don't cache a non-verdict
      out.set(o.id, { label: r.label, decision: r.decision });
      toWrite.push({
        userId: user.id,
        opportunityId: o.id,
        label: r.label,
        decision: r.decision,
        reason: r.reason || null,
        breakdown: (r.matchBreakdown as object) ?? undefined,
      });
    }
    if (toWrite.length) {
      // skipDuplicates: a concurrent request may have cached the same pair first.
      await prisma.matchVerdict.createMany({ data: toWrite, skipDuplicates: true }).catch(() => {});
    }
  }

  return out;
}
