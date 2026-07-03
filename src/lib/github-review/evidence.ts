// Builders for the GitHub evidence lines consumed by the pairing gate and the cover-letter
// generator. POSITIVE-ONLY by construction: evidence is emitted solely for fresh STRONG/ACTIVE
// reviews — weak/empty/mismatched GitHub must never reach a prompt where it could lower a
// candidate's assessment (coverage is ~22% of devs; private work is invisible).

import { githubReviewStamp } from './assess';
import type { GitHubReviewReport } from './types';

export type ReviewRow = {
  verdict: string;
  report: unknown;
  profileStamp: string;
  reviewedAt: Date;
};

export type ReviewUser = {
  githubUrl: string | null;
  parsedProfile: unknown;
};

const FRESH_MS = 30 * 864e5;
const POSITIVE = new Set(['STRONG', 'ACTIVE']);

/** True when the stored review still describes THIS profile (same github/skills/title) and is <30d old. */
export function isReviewFresh(user: ReviewUser, review: ReviewRow | null | undefined): review is ReviewRow {
  if (!review || !user.githubUrl) return false;
  if (Date.now() - review.reviewedAt.getTime() >= FRESH_MS) return false;
  const pp = user.parsedProfile as Record<string, unknown> | null;
  const stamp = githubReviewStamp({
    githubUrl: user.githubUrl,
    skills: Array.isArray(pp?.skills) ? (pp.skills as unknown[]).map(String) : [],
    title: typeof pp?.current_title === 'string' ? pp.current_title : null,
  });
  return review.profileStamp === stamp;
}

/** Repo-verified skill names for the ranking boost (fit-score), [] unless the review is fresh and
 *  positive — a MISMATCH account's skills may belong to someone else. */
export function verifiedSkillsFor(user: ReviewUser, review: ReviewRow | null | undefined): string[] {
  if (!isReviewFresh(user, review) || !POSITIVE.has(review.verdict)) return [];
  const r = review.report as GitHubReviewReport;
  return (r.matchedSkills || []).map(String);
}

/** Compact corroborating line for the pairing gate prompt (~100 tokens), or null when the review
 *  can't help (non-positive verdict / stale / absent). Callers append it verbatim. */
export function buildGateEvidence(user: ReviewUser, review: ReviewRow | null | undefined): string | null {
  if (!isReviewFresh(user, review) || !POSITIVE.has(review.verdict)) return null;
  const r = review.report as GitHubReviewReport;
  const parts: string[] = [`${review.verdict.toLowerCase()} public GitHub`];
  if (r.originalRepos) parts.push(`${r.originalRepos} original repos`);
  if (r.topLanguages?.length) parts.push(`top languages: ${r.topLanguages.slice(0, 3).map(l => l.lang).join(', ')}`);
  if (r.matchedSkills?.length) parts.push(`repo-verified skills: ${r.matchedSkills.slice(0, 8).join(', ')}`);
  const ev = (r.evidence || []).slice(0, 2).join('; ');
  return `${parts.join('; ')}${ev ? `. ${ev}` : ''}`;
}

/** One render-ready sentence for a cover letter, only when a repo-verified skill overlaps the
 *  opportunity's skills. Avoids commit counts (public API no longer exposes them reliably) and the
 *  word "projects" (would trip the letter's unsourced-metrics filter). */
export function buildLetterEvidence(
  user: ReviewUser,
  review: ReviewRow | null | undefined,
  oppSkills: string[] | null | undefined,
): string | null {
  if (!isReviewFresh(user, review) || !POSITIVE.has(review.verdict)) return null;
  const r = review.report as GitHubReviewReport;
  const verified = (r.matchedSkills || []).map(s => s.toLowerCase().trim());
  if (!verified.length) return null;
  const oppSet = new Set((oppSkills || []).map(s => s.toLowerCase().trim()).filter(Boolean));
  const overlap = (r.matchedSkills || []).filter(s => oppSet.has(s.toLowerCase().trim()));
  if (!overlap.length) return null;
  const activity = r.activityLevel === 'active' ? ', active this month' : r.activityLevel === 'moderate' ? ', recently active' : '';
  const repoBit = r.originalRepos ? `${r.originalRepos} original repos` : 'public work';
  return `My GitHub (${r.url}) backs this up — ${repoBit} in ${overlap.slice(0, 3).join('/')}${activity}.`;
}
