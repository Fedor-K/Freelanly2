// Block 2 — for ONE ATS role, pick the best 3 vetted candidates from our pool.
//
// Reverse of the normal matcher (candidate→opportunities): here we have one Lever role and rank
// candidates against it. Two passes to keep LLM cost sane:
//   1. lexical pre-rank the whole full-cycle pool (no LLM) → top N
//   2. vet those N with the SAME gate/verifier as auto-apply → keep SEND, take 3
// The JD is parsed ONCE per role (not per candidate); only runGate is genuinely per-candidate.
import { prisma } from '@/lib/db';
import { parseJD, buildBreakdown } from '@/lib/match-breakdown/generate';
import { runGate, assess } from '@/services/matching/gate';
import { computeCaveats } from '@/lib/match-caveats';
import type { LeverPosting } from '@/services/sources/lever-ats';

const LABEL_RANK: Record<string, number> = { Strong: 0, Good: 1, Weak: 2 };

// Quality floor for what we'll actually pitch to a recruiter. A "SEND" gate decision is necessary
// but NOT sufficient: Phase-0 testing showed roles where the gate returned Weak/ratio=0 candidates
// (breakdown matched ZERO requirements) — pitching those reads as spam. We only ship genuinely-fit
// candidates: label Strong/Good AND at least one matched requirement (ratio>0). A role whose best
// candidates don't clear this returns [] (better to send nothing than a weak shortlist).
// Env-overridable: SHORTLIST_ALLOW_WEAK=true keeps Weak; SHORTLIST_MIN_RATIO sets the ratio floor.
const ALLOW_WEAK = process.env.SHORTLIST_ALLOW_WEAK === 'true';
const MIN_RATIO = (() => { const n = parseFloat(process.env.SHORTLIST_MIN_RATIO || ''); return Number.isFinite(n) ? n : 0.0001; })();
const OK_LABELS = new Set(ALLOW_WEAK ? ['Strong', 'Good', 'Weak'] : ['Strong', 'Good']);

function clearsQualityFloor(c: ShortlistCandidate): boolean {
  if (c.decision !== 'SEND') return false;
  if (!OK_LABELS.has(c.label || '')) return false;             // drop Weak/unlabeled (unless ALLOW_WEAK)
  const ratio = Number((c.matchBreakdown as { ratio?: unknown } | null)?.ratio ?? 0);
  return ratio >= MIN_RATIO;                                   // require ≥1 matched requirement
}

function lexScore(profile: unknown, roleText: string): number {
  const p = (profile || {}) as Record<string, unknown>;
  const skills = ((p.skills as string[]) || []).map(s => String(s).toLowerCase());
  const title = String(p.current_title || '').toLowerCase();
  const hay = roleText.toLowerCase();
  let score = 0;
  for (const s of skills) if (s.length > 2 && hay.includes(s)) score += 2;
  for (const w of title.split(/[^a-z0-9+#.]+/)) if (w.length > 3 && hay.includes(w)) score += 1;
  return score;
}

export type ShortlistCandidate = {
  userId: string;
  name: string | null;
  email: string;
  location: string | null;
  linkedinUrl: string | null;
  image: string | null;
  label: string | undefined;
  decision: 'SEND' | 'NO';
  matchBreakdown: Record<string, unknown> | null;
  lexScore: number;
};

// Vet one candidate against a PRE-PARSED jd (parseJD already done once for the role).
async function vetCandidate(
  role: LeverPosting,
  jd: Awaited<ReturnType<typeof parseJD>>,
  jdText: string,
  u: { id: string; name: string | null; email: string; location: string | null; linkedinUrl: string | null; image: string | null; parsedProfile: unknown; resumeText: string | null },
  lex: number,
): Promise<ShortlistCandidate> {
  const p = (u.parsedProfile || {}) as Record<string, unknown>;
  const cvText = u.resumeText || '';
  const bd = buildBreakdown(jd, {
    jdText, cvText,
    candidateSkills: (p.skills as string[]) || [],
    candidateLanguages: (p.languages as string[]) || [],
    candidateTitle: typeof p.current_title === 'string' ? (p.current_title as string) : null,
    candidateYears: typeof p.experience_years === 'number' ? (p.experience_years as number) : null,
    candidateLocation: typeof p.location === 'string' ? (p.location as string) : null,
  });
  const bdLines = (bd.lines as Array<{ core?: boolean; status?: string }>) || [];
  const missingCore = bdLines.filter(l => l.core === true && l.status !== 'full').length;
  const coreMatched = bdLines.filter(l => l.core === true && l.status === 'full').length;
  const matchBreakdown: Record<string, unknown> = {
    v: 1, matched: bd.matched, total: bd.total, ratio: bd.total ? Math.round((bd.matched / bd.total) * 100) / 100 : 0,
    lines: bd.lines, yearsContext: bd.yearsContext, locationContext: bd.locationContext,
  };
  let decision: 'SEND' | 'NO' = 'SEND';
  try {
    const g = await runGate({
      jobTitle: role.title, jobDescription: role.descriptionPlain, jobCountry: role.country,
      candidateTitle: typeof p.current_title === 'string' ? (p.current_title as string) : undefined,
      candidateField: typeof p.field === 'string' ? (p.field as string) : undefined,
      candidateYears: typeof p.experience_years === 'number' ? (p.experience_years as number) : null,
      candidateLocation: typeof p.location === 'string' ? (p.location as string) : undefined,
      candidateLanguages: (p.languages as string[]) || [],
      candidateSkills: (p.skills as string[]) || [],
      candidateCv: cvText,
    });
    const d = assess(g, { matched: bd.matched, total: bd.total, missingCore, coreMatched }, cvText, role.title, !!cvText);
    Object.assign(matchBreakdown, {
      profession: d.extras.profession, english_req: d.extras.english_req, hard_fail: d.extras.hard_fail,
      hard_kind: d.extras.hard_kind, location_flag: d.extras.location_flag, gateReason: d.reason,
    });
    decision = d.decision;
  } catch { /* gate fail-open: SEND with breakdown only */ }
  return {
    userId: u.id, name: u.name, email: u.email, location: u.location, linkedinUrl: u.linkedinUrl, image: u.image,
    label: computeCaveats(matchBreakdown)?.strength, decision, matchBreakdown, lexScore: lex,
  };
}

// Run async tasks with bounded concurrency.
async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]); }
  }));
  return out;
}

/** Pick the top `limit` vetted candidates for a Lever role. */
export async function buildShortlistForRole(
  role: LeverPosting,
  opts: { pre?: number; limit?: number; concurrency?: number } = {},
): Promise<ShortlistCandidate[]> {
  const pre = opts.pre ?? 25;
  const limit = opts.limit ?? 3;
  const concurrency = opts.concurrency ?? 4;
  const jdText = `${role.title}\n${role.descriptionPlain}`;
  const roleText = `${role.title}\n${role.requirements.join('\n')}\n${role.descriptionPlain}`;

  // Pass 1 — lexical pre-rank (no LLM).
  const pool = await prisma.user.findMany({ where: { resumeUrl: { not: null } }, select: { id: true, parsedProfile: true } });
  const ranked = pool
    .map(u => ({ id: u.id, s: lexScore(u.parsedProfile, roleText) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, pre);
  if (!ranked.length) return [];

  // Pass 2 — fetch full profiles, parse JD once, vet with bounded concurrency.
  const full = await prisma.user.findMany({
    where: { id: { in: ranked.map(r => r.id) } },
    select: { id: true, name: true, email: true, location: true, linkedinUrl: true, image: true, parsedProfile: true, resumeText: true },
  });
  const byId = new Map(full.map(u => [u.id, u]));
  const jd = await parseJD(jdText, role.title);

  const vetted = await mapLimit(ranked.filter(r => byId.has(r.id)), concurrency, r =>
    vetCandidate(role, jd, jdText, byId.get(r.id)!, r.s));

  return vetted
    .filter(clearsQualityFloor)
    .sort((a, b) => (LABEL_RANK[a.label || 'Weak'] - LABEL_RANK[b.label || 'Weak']) || (b.lexScore - a.lexScore))
    .slice(0, limit);
}
