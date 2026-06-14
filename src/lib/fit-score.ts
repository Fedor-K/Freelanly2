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
