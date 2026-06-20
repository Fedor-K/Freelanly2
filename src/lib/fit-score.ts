/**
 * Lightweight, LLM-free candidate↔opportunity fit scoring.
 *
 * Pure lexical overlap (title/field tokens + skills) so it can run in code over the WHOLE base in
 * milliseconds — used to rank the discovery feed per user and to shortlist weak-match suggestions
 * before the expensive assessPairing vet. This is a cheap RANKING signal, NOT the verdict: the real
 * matcher (assessPairing) still decides what actually gets applied to / surfaced as a suggestion.
 */

const STOP = new Set([
  'the', 'and', 'for', 'with', 'our', 'your', 'you', 'are', 'will', 'that', 'this', 'from', 'into',
  'remote', 'full', 'time', 'part', 'job', 'role', 'position', 'team', 'work', 'senior', 'junior',
  'mid', 'lead', 'i', 'ii', 'iii',
]);

/** Significant lowercase tokens (drops stopwords + short noise) for lexical overlap. */
export function fitTokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z][a-z+#.]{2,}/g) || []).filter(t => !STOP.has(t));
}

export type FitContext = { skills: Set<string>; titleTokens: Set<string>; empty: boolean };

/** Build the candidate side once, then score many opportunities against it. */
export function buildFitContext(profile: Record<string, unknown> | null | undefined): FitContext {
  const skills = new Set(
    (((profile?.skills as string[]) || []).map(s => String(s).toLowerCase().trim()).filter(Boolean)),
  );
  const titleTokens = new Set([
    ...fitTokens(typeof profile?.current_title === 'string' ? (profile.current_title as string) : ''),
    ...fitTokens(typeof profile?.field === 'string' ? (profile.field as string) : ''),
  ]);
  return { skills, titleTokens, empty: skills.size === 0 && titleTokens.size === 0 };
}

/**
 * Raw fit score for one opportunity. Title/field overlap is the stronger role-fit signal (a
 * "Project Manager" candidate matching a "Project Manager" role), skills second. Returns 0 when the
 * candidate side is empty (no profile) — callers fall back to recency.
 */
export function scoreFit(ctx: FitContext, opp: { title: string; skills?: string[] | null }): number {
  if (ctx.empty) return 0;
  const titleLower = opp.title.toLowerCase();
  const oppSkills = (opp.skills || []).map(s => s.toLowerCase().trim());

  let skillScore = 0;
  for (const s of ctx.skills) if (oppSkills.includes(s) || titleLower.includes(s)) skillScore++;

  let titleScore = 0;
  for (const t of fitTokens(opp.title)) if (ctx.titleTokens.has(t)) titleScore++;

  return titleScore * 3 + skillScore;
}

export type FitLabel = 'Strong' | 'Good' | 'Weak';

// Tuning knobs for the normalized label (calibrated against real profiles — see plan Verification).
// Title (profession) match is the dominant signal; skills second. A "Strong" match needs the
// candidate's profession in the role title AND some skill overlap.
// Calibrated 2026-06-20 against real profiles over the live 7-day pool (~2.5k opps): these values give
// a typical target profile (QA/.NET/data/design/PM) ~10-40 Strong matches (median ~33) — enough to fill
// a strong-match landing without flooding. Tighten STRONG_MIN toward 80 to make "Strong" rarer.
const TITLE_WEIGHT = 0.6;          // share of the 0-100 score driven by title/profession overlap
const SKILL_WEIGHT = 0.4;          // share driven by skill overlap
const TITLE_FULL_CREDIT = 1;       // matching this many of the candidate's title tokens = full title credit
const SKILL_FULL_CREDIT = 4;       // matching this many skills = full skill credit
const STRONG_MIN = 70;             // ≥ this → Strong (profession in title + ≥1 matched skill)
const GOOD_MIN = 50;               // ≥ this → Good, else Weak

/**
 * Normalized 0-100 fit + Strong/Good/Weak label for the discovery feed. Same cheap lexical signals as
 * scoreFit (title + skills) but scaled to a stable 0-100 so a "Strong" cutoff means the same thing for
 * every profile regardless of how many skills it lists. This is still a RANKING signal, not the real
 * matcher verdict — used to surface strong matches first on the candidate's landing feed.
 */
export function scoreFitLabeled(
  ctx: FitContext,
  opp: { title: string; skills?: string[] | null },
): { score: number; label: FitLabel } {
  if (ctx.empty) return { score: 0, label: 'Weak' };

  const titleLower = opp.title.toLowerCase();
  const oppSkills = (opp.skills || []).map(s => s.toLowerCase().trim());

  let skillMatches = 0;
  for (const s of ctx.skills) if (oppSkills.includes(s) || titleLower.includes(s)) skillMatches++;

  let titleMatches = 0;
  for (const t of fitTokens(opp.title)) if (ctx.titleTokens.has(t)) titleMatches++;

  const titleFrac = ctx.titleTokens.size > 0
    ? Math.min(1, titleMatches / Math.min(TITLE_FULL_CREDIT, ctx.titleTokens.size))
    : 0;
  const skillFrac = ctx.skills.size > 0
    ? Math.min(1, skillMatches / Math.min(SKILL_FULL_CREDIT, ctx.skills.size))
    : 0;

  const score = Math.round(100 * (TITLE_WEIGHT * titleFrac + SKILL_WEIGHT * skillFrac));
  const label: FitLabel = score >= STRONG_MIN ? 'Strong' : score >= GOOD_MIN ? 'Good' : 'Weak';
  return { score, label };
}
