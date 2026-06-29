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

/** Is a candidate skill present in the role TITLE? SCORER-1: a single-word skill must match a whole
 *  title TOKEN ("java" ≠ "javascript", "go" ≠ "google") — never a raw substring; multi-word skills
 *  phrase-match; ≤2-char skills never match a title (too collision-prone — they only count via an
 *  exact opp-skills tag). Fixes false skill points + fabricated "matched on: java" rationale. */
function skillInTitle(s: string, titleTokens: Set<string>, titleLower: string): boolean {
  if (s.length <= 2) return false;
  if (s.includes(' ')) return titleLower.includes(s);
  return titleTokens.has(s);
}

// Known language names (English-canonical, lowercase) used by the language-gap guard. A role that
// demands a language the candidate doesn't have can't be a Strong match — even if title + tools overlap.
const LANGUAGES = [
  'english', 'spanish', 'french', 'german', 'korean', 'japanese', 'chinese', 'mandarin', 'cantonese',
  'portuguese', 'italian', 'russian', 'arabic', 'dutch', 'hindi', 'turkish', 'polish', 'swedish',
  'norwegian', 'danish', 'finnish', 'greek', 'hebrew', 'thai', 'vietnamese', 'indonesian', 'ukrainian',
  'romanian', 'czech', 'hungarian', 'tagalog', 'bengali', 'urdu', 'farsi', 'persian', 'catalan',
];

/** Canonical language names mentioned anywhere in the given strings. */
function detectLanguages(...parts: string[]): Set<string> {
  const blob = parts.join(' ').toLowerCase();
  const found = new Set<string>();
  for (const lang of LANGUAGES) if (new RegExp(`\\b${lang}\\b`).test(blob)) found.add(lang);
  return found;
}

export type FitContext = { skills: Set<string>; titleTokens: Set<string>; languages: Set<string>; empty: boolean };

/** Build the candidate side once, then score many opportunities against it. */
export function buildFitContext(profile: Record<string, unknown> | null | undefined): FitContext {
  const skills = new Set(
    (((profile?.skills as string[]) || []).map(s => String(s).toLowerCase().trim()).filter(Boolean)),
  );
  const titleTokens = new Set([
    ...fitTokens(typeof profile?.current_title === 'string' ? (profile.current_title as string) : ''),
    ...fitTokens(typeof profile?.field === 'string' ? (profile.field as string) : ''),
  ]);
  const languages = detectLanguages(...((profile?.languages as string[]) || []).map(String));
  return { skills, titleTokens, languages, empty: skills.size === 0 && titleTokens.size === 0 };
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
  const oppTitleTokens = fitTokens(opp.title);
  const oppTitleTokenSet = new Set(oppTitleTokens);

  let skillScore = 0;
  for (const s of ctx.skills) if (oppSkills.includes(s) || skillInTitle(s, oppTitleTokenSet, titleLower)) skillScore++;

  let titleScore = 0;
  for (const t of oppTitleTokens) if (ctx.titleTokens.has(t)) titleScore++;

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

// Semantic blend — applied ONLY when scoreFitLabeled is given a precomputed cosine similarity (`sim`,
// 0-1) from the embedding layer. The blend judges the label off meaning+lexical, and `SEM_FLOOR` is a
// hard eligibility gate: a role whose MEANING is far from the candidate can't be Good+ even if a single
// generic title token overlapped ("business"/"manager") — this is what closes the feed↔gate poor_match.
// Env-tunable; when no `sim` is passed the function behaves exactly as the pure-lexical original.
const HYBRID_W_SEM = Number(process.env.HYBRID_W_SEM || 0.7);
const HYBRID_W_LEX = Number(process.env.HYBRID_W_LEX || 0.3);
const SEM_FLOOR = Number(process.env.SEM_FLOOR || 0.45);

/**
 * Normalized 0-100 fit + Strong/Good/Weak label for the discovery feed. Same cheap lexical signals as
 * scoreFit (title + skills) but scaled to a stable 0-100 so a "Strong" cutoff means the same thing for
 * every profile regardless of how many skills it lists. This is still a RANKING signal, not the real
 * matcher verdict — used to surface strong matches first on the candidate's landing feed.
 */
export type FitResult = {
  score: number;
  label: FitLabel;
  /** Why it scored — the candidate's own skills found in the role (original casing), for the UI rationale. */
  matchedSkills: string[];
  /** Candidate profession/title words also in the role title (e.g. ["project","manager"]) — for the rationale. */
  matchedTitleTokens: string[];
  /** Languages the role demands that the candidate doesn't list — a hard gap that blocks "Strong". */
  languageGap: string[];
  /** Named specializations in the role title (also listed as requirements) the candidate lacks — blocks "Strong". */
  missingCore: string[];
};

export function scoreFitLabeled(
  ctx: FitContext,
  opp: { title: string; skills?: string[] | null },
  sim?: number,
): FitResult {
  if (ctx.empty) return { score: 0, label: 'Weak', matchedSkills: [], matchedTitleTokens: [], languageGap: [], missingCore: [] };

  const titleLower = opp.title.toLowerCase();
  const oppSkillsRaw = opp.skills || [];
  const oppSkills = oppSkillsRaw.map(s => s.toLowerCase().trim());
  const oppTitleTokens = fitTokens(opp.title);
  const oppTitleTokenSet = new Set(oppTitleTokens);

  // Collect the actual matched skills (display casing) so the card can explain WHY it's a match.
  const matchedSkills: string[] = [];
  for (const s of ctx.skills) {
    const idx = oppSkills.indexOf(s);
    if (idx !== -1) matchedSkills.push(oppSkillsRaw[idx]);
    else if (skillInTitle(s, oppTitleTokenSet, titleLower)) matchedSkills.push(s); // SCORER-1: token-match, not substring
  }
  const skillMatches = matchedSkills.length;

  // Candidate profession words present in the role title (in title order, so they read naturally).
  const matchedTitleTokens: string[] = [];
  for (const t of oppTitleTokens) if (ctx.titleTokens.has(t)) matchedTitleTokens.push(t);
  const titleMatches = matchedTitleTokens.length;

  const titleFrac = ctx.titleTokens.size > 0
    ? Math.min(1, titleMatches / Math.min(TITLE_FULL_CREDIT, ctx.titleTokens.size))
    : 0;
  const skillFrac = ctx.skills.size > 0
    ? Math.min(1, skillMatches / Math.min(SKILL_FULL_CREDIT, ctx.skills.size))
    : 0;

  const lexScore = Math.round(100 * (TITLE_WEIGHT * titleFrac + SKILL_WEIGHT * skillFrac));
  // With a semantic similarity supplied, judge the label off the blend; otherwise pure lexical (the
  // original behaviour, byte-for-byte). sim ∈ [0,1].
  const hasSim = typeof sim === 'number' && !Number.isNaN(sim);
  const score = hasSim ? Math.round(100 * (HYBRID_W_SEM * (sim as number) + HYBRID_W_LEX * (lexScore / 100))) : lexScore;
  let label: FitLabel = score >= STRONG_MIN ? 'Strong' : score >= GOOD_MIN ? 'Good' : 'Weak';

  // Language-gap guard: a Strong label is wrong if the role demands a (non-English) language the
  // candidate doesn't have — the lexical score can't see it, so catch it here. Only when we actually
  // know the candidate's languages (else we'd downgrade good matches on a parsing gap). English is
  // excluded: it's near-universal and unreliably parsed, so never the disqualifier.
  let languageGap: string[] = [];
  if (label === 'Strong' && ctx.languages.size > 0) {
    const roleLangs = detectLanguages(opp.title, oppSkills.join(' '));
    languageGap = [...roleLangs].filter(l => l !== 'english' && !ctx.languages.has(l));
    if (languageGap.length > 0) label = 'Good'; // demote out of the Strong section
  }

  // Core-specialization guard: a named tech in the role TITLE that's also a listed requirement
  // (e.g. "ServiceNow" in "ServiceNow Project Manager") but absent from the candidate's profile means
  // the role's defining specialization is missing — not Strong, even if the generic title + a couple of
  // skills overlap. Only single-word title tokens that exactly match a skill tag trigger, so generic
  // words ("project") and multi-word tags ("ms project") never false-fire.
  const missingCore: string[] = [];
  if (label === 'Strong') {
    for (const t of oppTitleTokens) {
      const idx = oppSkills.indexOf(t);
      if (idx !== -1 && !ctx.skills.has(t) && !ctx.titleTokens.has(t)) missingCore.push(oppSkillsRaw[idx]);
    }
    if (missingCore.length > 0) label = 'Good';
  }

  // Semantic floor: meaning too far from the candidate → not Good+, regardless of lexical overlap.
  // This demotes the bucket-B over-promises (one generic shared word) that the lexical score can't see.
  if (hasSim && (sim as number) < SEM_FLOOR) label = 'Weak';

  return { score, label, matchedSkills, matchedTitleTokens, languageGap, missingCore };
}
