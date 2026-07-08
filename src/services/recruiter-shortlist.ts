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
import { buildGateEvidence, type ReviewRow } from '@/lib/github-review/evidence';
import { computeCaveats } from '@/lib/match-caveats';
import { generateRecruiterRationale } from '@/services/matching/recruiter-rationale';
import { hasRealCV } from '@/lib/resume-attachment';
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
  title: string | null;
  email: string;
  location: string | null;
  linkedinUrl: string | null;
  image: string | null;
  label: string | undefined;
  decision: 'SEND' | 'NO';
  matchBreakdown: Record<string, unknown> | null;
  lexScore: number;
  // Screening fields recruiters ask for (self-reported unless noted) — plumbed into the card + landing.
  years: number | null;
  skills: string[];
  timezone: string | null;
  availability: string | null;   // "~30 hrs/week"
  availableFrom: string | null;  // "immediately", "mid-November"
  salaryExpectation: string | null;
  portfolioUrl: string | null;
  githubUrl: string | null;
  githubVerified: boolean;       // has a fresh STRONG/ACTIVE GitHubReview
};

// Vet one candidate against a PRE-PARSED jd (parseJD already done once for the role).
async function vetCandidate(
  role: LeverPosting,
  jd: Awaited<ReturnType<typeof parseJD>>,
  jdText: string,
  u: { id: string; name: string | null; email: string; location: string | null; linkedinUrl: string | null; image: string | null; parsedProfile: unknown; resumeText: string | null; resumeUrl: string | null; githubUrl?: string | null; githubReview?: ReviewRow | null; timezone?: string | null; availability?: string | null; availableFrom?: string | null; salaryExpectation?: string | null; portfolioUrl?: string | null },
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
      candidateGithub: buildGateEvidence({ githubUrl: u.githubUrl ?? null, parsedProfile: u.parsedProfile }, u.githubReview ?? null),
    });
    // Real-CV check keyed on the Blob URL (same as the worker / send path), NOT on whether résumé
    // TEXT extracted — a genuine Blob PDF whose text extraction failed must not be NO'd as "no real
    // CV", and a text-only/machine profile must not pass as one (SHORTLIST-5 / unified hasRealCV).
    const d = assess(g, { matched: bd.matched, total: bd.total, missingCore, coreMatched }, cvText, role.title, hasRealCV(u));
    Object.assign(matchBreakdown, {
      profession: d.extras.profession, english_req: d.extras.english_req, hard_fail: d.extras.hard_fail,
      hard_kind: d.extras.hard_kind, location_flag: d.extras.location_flag, gateReason: d.reason,
    });
    decision = d.decision;
  } catch {
    // FAIL CLOSED on the paid card (SHORTLIST-1): if the gate didn't run (e.g. a transient AI
    // outage) we can't vouch for profession / hard-fail, so we must NOT ship the candidate as
    // "vetted". Drop them this run — clearsQualityFloor rejects decision!=='SEND'. Next run, with
    // the gate back up, they're reconsidered. Auto-apply's send path fails open by design; the
    // recruiter shortlist is the opposite — never present an unvetted candidate to a paying hirer.
    decision = 'NO';
    Object.assign(matchBreakdown, { gateReason: 'gate_unvetted', gate_unvetted: true });
  }
  return {
    userId: u.id, name: u.name, title: (typeof p.current_title === 'string' ? p.current_title : null),
    email: u.email, location: u.location, linkedinUrl: u.linkedinUrl, image: u.image,
    label: computeCaveats(matchBreakdown)?.strength, decision, matchBreakdown, lexScore: lex,
    years: typeof p.experience_years === 'number' ? (p.experience_years as number) : null,
    skills: Array.isArray(p.skills) ? (p.skills as unknown[]).map(String).slice(0, 12) : [],
    timezone: u.timezone ?? null,
    availability: u.availability ?? null,
    availableFrom: u.availableFrom ?? null,
    salaryExpectation: u.salaryExpectation ?? null,
    portfolioUrl: u.portfolioUrl ?? null,
    githubUrl: u.githubUrl ?? null,
    githubVerified: !!u.githubReview && (u.githubReview.verdict === 'STRONG' || u.githubReview.verdict === 'ACTIVE'),
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
    select: { id: true, name: true, email: true, location: true, linkedinUrl: true, image: true, parsedProfile: true, resumeText: true, resumeUrl: true, githubUrl: true, githubReview: { select: { verdict: true, report: true, profileStamp: true, reviewedAt: true } }, timezone: true, availability: true, availableFrom: true, salaryExpectation: true, portfolioUrl: true },
  });
  const byId = new Map(full.map(u => [u.id, u]));
  const jd = await parseJD(jdText, role.title);

  const vetted = await mapLimit(ranked.filter(r => byId.has(r.id)), concurrency, r =>
    vetCandidate(role, jd, jdText, byId.get(r.id)!, r.s));

  const top = vetted
    .filter(clearsQualityFloor)
    .sort((a, b) => (LABEL_RANK[a.label || 'Weak'] - LABEL_RANK[b.label || 'Weak']) || (b.lexScore - a.lexScore))
    .slice(0, limit);

  // Enrich ONLY the final few with the matcher's human-readable "why" (one AI call each) — this is
  // what the recruiter card shows under each candidate, so the pick is explained, not just labelled.
  await Promise.all(top.map(async c => {
    const u = byId.get(c.userId); if (!u || !c.matchBreakdown) return;
    const p = (u.parsedProfile || {}) as Record<string, unknown>;
    const lines = (c.matchBreakdown.lines as Array<{ label?: string; core?: boolean; status?: string }>) || [];
    const lab = (l: { label?: string }) => (l.label || '').trim();
    try {
      const why = await generateRecruiterRationale({
        jobTitle: role.title, jobDescription: role.descriptionPlain,
        candidateName: u.name,
        candidateTitle: c.title, candidateYears: typeof p.experience_years === 'number' ? (p.experience_years as number) : null,
        candidateSkills: (p.skills as string[]) || [], candidateBackground: u.resumeText || '',
        matched: lines.filter(l => l.status === 'full').map(lab).filter(Boolean),
        missingCore: lines.filter(l => l.core && l.status !== 'full').map(lab).filter(Boolean),
        missing: lines.filter(l => l.status !== 'full').map(lab).filter(Boolean),
        profession: (c.matchBreakdown.profession as string) || null,
        matchedN: (c.matchBreakdown.matched as number) ?? 0, totalN: (c.matchBreakdown.total as number) ?? 0,
        language: 'en', // recruiter-facing card → English
      });
      if (why) c.matchBreakdown.recruiterReasoning = why;
    } catch { /* rationale is best-effort — card still renders without it */ }
  }));

  return top;
}
