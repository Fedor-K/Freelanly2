// Deterministic metrics + AI judgement over a GitHubSnapshot. The numbers (activity, languages,
// repo counts) are computed in code; the AI only judges what code can't — does the visible work
// match the claimed skills, and is anything fishy. Self-contained lazy AI client (ai.ts idiom;
// getAIClient isn't exported and this must also run from CLI scripts).

import { createHash } from 'crypto';
import OpenAI from 'openai';
import type { GitHubSnapshot, GitHubReviewReport, GitHubReviewFlag, GitHubReviewVerdict } from './types';

const MODEL = 'glm-4-32b-0414-128k';
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.ZAI_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.z.ai/api/paas/v4',
      timeout: 30000,
      maxRetries: 2,
    });
  }
  return _client;
}

const VERDICTS: GitHubReviewVerdict[] = ['STRONG', 'ACTIVE', 'WEAK', 'INACTIVE', 'MISMATCH', 'UNVERIFIABLE'];
const FLAGS: GitHubReviewFlag[] = ['all_forks', 'tutorial_clones', 'dead_account', 'name_mismatch', 'profile_mismatch', 'org_account', 'empty_account', 'new_account'];

/** Fingerprint of the inputs a review depends on — recompute when the link, skills or title change. */
export function githubReviewStamp(parts: { githubUrl: string; skills?: string[]; title?: string | null }): string {
  const s = `${parts.githubUrl}|${(parts.skills || []).map(x => String(x).toLowerCase().trim()).filter(Boolean).sort().join(',')}|${(parts.title || '').toLowerCase().trim()}`;
  return createHash('sha1').update(s).digest('hex').slice(0, 16);
}

export type DeterministicMetrics = Pick<
  GitHubReviewReport,
  'activityLevel' | 'commits90d' | 'activeDays90d' | 'lastActivityAt' | 'accountCreatedAt' | 'publicRepos' | 'originalRepos' | 'followers' | 'topLanguages'
> & { baselineFlags: GitHubReviewFlag[] };

export function computeDeterministicMetrics(snap: GitHubSnapshot): DeterministicMetrics {
  const originalRepos = snap.repos.filter(r => !r.fork).length;
  const publicRepos = snap.profile.publicRepos;
  const pushedWithin12mo = snap.repos.some(r => r.pushedAt && Date.now() - new Date(r.pushedAt).getTime() < 365 * 864e5);

  let activityLevel: DeterministicMetrics['activityLevel'];
  if (snap.activity.activeDays90d >= 10) activityLevel = 'active';
  else if (snap.activity.activeDays90d >= 1) activityLevel = 'moderate';
  else if (pushedWithin12mo) activityLevel = 'dormant';
  else activityLevel = 'dead';

  const baselineFlags: GitHubReviewFlag[] = [];
  if (activityLevel === 'dead') baselineFlags.push('dead_account');
  if (publicRepos === 0) baselineFlags.push('empty_account');
  else if (originalRepos === 0) baselineFlags.push('all_forks');
  if (snap.profile.createdAt && Date.now() - new Date(snap.profile.createdAt).getTime() < 182 * 864e5) baselineFlags.push('new_account');

  return {
    activityLevel,
    commits90d: snap.activity.commitsEstimate90d,
    activeDays90d: snap.activity.activeDays90d,
    lastActivityAt: snap.activity.lastEventAt,
    accountCreatedAt: snap.profile.createdAt,
    publicRepos,
    originalRepos,
    followers: snap.profile.followers,
    topLanguages: snap.languages.map(l => ({ lang: l.lang, pct: l.pct })),
    baselineFlags,
  };
}

export type AiJudgement = Pick<
  GitHubReviewReport,
  'stackMatch' | 'matchedSkills' | 'unverifiedSkills' | 'flags' | 'evidence' | 'verdict' | 'summary'
>;

/** AI half of the report. Returns null on ANY AI failure (outage, parse) — callers must store
 *  NOTHING in that case (never freeze a blank/fail-open verdict; assess-pairing-cached discipline). */
export async function assessGitHubEvidence(
  snap: GitHubSnapshot,
  claimed: { name: string | null; skills: string[]; title: string | null; experienceYears: number | null },
): Promise<AiJudgement | null> {
  try {
    const det = computeDeterministicMetrics(snap);
    const input = {
      github: {
        username: snap.username,
        profileName: snap.profile.name,
        bio: snap.profile.bio,
        location: snap.profile.location,
        accountCreatedAt: snap.profile.createdAt,
        activityLevel: det.activityLevel,
        activeDays90d: det.activeDays90d,
        commitsEstimate90d: det.commits90d,
        publicRepos: det.publicRepos,
        originalRepos: det.originalRepos,
        topLanguages: det.topLanguages,
        repos: snap.repos.slice(0, 30).map(r => ({ name: r.name, lang: r.language, fork: r.fork, stars: r.stars, pushed: r.pushedAt?.slice(0, 10), desc: (r.description || '').slice(0, 90) })),
      },
      claimed: {
        name: claimed.name,
        title: claimed.title,
        experienceYears: claimed.experienceYears,
        skills: claimed.skills.slice(0, 30),
      },
    };

    const response = await getClient().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: `You review a freelance candidate's PUBLIC GitHub against their claimed profile, producing evidence for recruiters. Rules:
- Absence of public evidence for a skill is NEUTRAL (list under unverifiedSkills) — private/work repos are invisible. Never treat missing evidence as negative.
- MISMATCH verdict is ONLY for positive contradiction (e.g. account clearly belongs to someone else, or repos contradict the claimed field entirely). Empty/quiet accounts are WEAK or INACTIVE, never MISMATCH.
- tutorial_clones flag: original repos look like course exercises / boilerplate clones rather than real work.
- name_mismatch flag: github profile name/username is not plausibly the claimed person (transliteration and initials are fine).
- evidence: 3-6 short concrete render-ready lines citing repos/languages/activity, e.g. "8 original TypeScript repos, most recent pushed 2026-06".
Respond with JSON only: {"stackMatch": 0-100, "matchedSkills": string[], "unverifiedSkills": string[], "flags": string[], "evidence": string[], "verdict": "STRONG|ACTIVE|WEAK|INACTIVE|MISMATCH", "summary": "1-2 sentences"}
Verdict guide: STRONG = active account with clear evidence for core claimed skills; ACTIVE = alive and plausible but partial evidence; WEAK = little to judge from; INACTIVE = dormant/dead account; MISMATCH = positive contradiction.`,
        },
        { role: 'user', content: JSON.stringify(input) },
      ],
      temperature: 0.1,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    const raw = JSON.parse(content) as Record<string, unknown>;

    const stackMatch = Math.max(0, Math.min(100, Math.round(Number(raw.stackMatch) || 0)));
    const flags = (Array.isArray(raw.flags) ? raw.flags : [])
      .map(f => String(f) as GitHubReviewFlag)
      .filter(f => FLAGS.includes(f));
    let verdict = String(raw.verdict || '') as GitHubReviewVerdict;
    if (!VERDICTS.includes(verdict)) {
      // deterministic fallback if the model returns an off-enum verdict
      verdict = det.activityLevel === 'dead' || det.activityLevel === 'dormant' ? 'INACTIVE' : stackMatch >= 60 ? 'ACTIVE' : 'WEAK';
    }
    const asStrings = (v: unknown, cap: number) => (Array.isArray(v) ? v.map(String).slice(0, cap) : []);

    return {
      stackMatch,
      matchedSkills: asStrings(raw.matchedSkills, 20),
      unverifiedSkills: asStrings(raw.unverifiedSkills, 30),
      flags,
      evidence: asStrings(raw.evidence, 6),
      verdict,
      summary: String(raw.summary || '').slice(0, 400),
    };
  } catch (e) {
    console.error('[GitHubReview] AI assessment failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
