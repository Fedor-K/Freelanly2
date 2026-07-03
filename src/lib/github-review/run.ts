// Orchestrator: one call reviews one candidate's GitHub end-to-end (freshness check → fetch →
// deterministic metrics → AI judgement → upsert). Shared by the admin re-run route and the CLI
// batch script so there is exactly one write path for GitHubReview rows.

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { usernameFromGitHubUrl } from './extract-username';
import { fetchGitHubSnapshot } from './fetch';
import { assessGitHubEvidence, computeDeterministicMetrics, githubReviewStamp } from './assess';
import type { GitHubReviewReport } from './types';

const TTL_MS = 30 * 864e5; // 30 days — accounts change slowly; profileStamp catches profile edits sooner

export type RunResult =
  | { status: 'done' | 'cached'; report: GitHubReviewReport }
  | { status: 'skipped'; reason: 'no_github_url' | 'ai_unavailable' | 'rate_limited' | 'fetch_error' };

async function upsertReview(userId: string, username: string, report: GitHubReviewReport, snapshot: unknown, stamp: string) {
  const reportJson = report as unknown as Prisma.InputJsonValue;
  const snapJson = snapshot ? (snapshot as Prisma.InputJsonValue) : Prisma.JsonNull;
  await prisma.gitHubReview.upsert({
    where: { userId },
    create: { userId, username, verdict: report.verdict, report: reportJson, snapshot: snapJson, profileStamp: stamp },
    update: { username, verdict: report.verdict, report: reportJson, snapshot: snapJson, profileStamp: stamp, reviewedAt: new Date() },
  });
}

export async function runGitHubReview(userId: string, opts?: { force?: boolean }): Promise<RunResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, githubUrl: true, parsedProfile: true },
  });
  if (!user?.githubUrl) return { status: 'skipped', reason: 'no_github_url' };
  const username = usernameFromGitHubUrl(user.githubUrl);
  if (!username) return { status: 'skipped', reason: 'no_github_url' };

  const pp = user.parsedProfile as Record<string, unknown> | null;
  const skills = Array.isArray(pp?.skills) ? (pp.skills as unknown[]).map(String) : [];
  const title = typeof pp?.current_title === 'string' ? pp.current_title : null;
  const stamp = githubReviewStamp({ githubUrl: user.githubUrl, skills, title });

  if (!opts?.force) {
    const existing = await prisma.gitHubReview.findUnique({ where: { userId } });
    if (existing && existing.profileStamp === stamp && Date.now() - existing.reviewedAt.getTime() < TTL_MS) {
      return { status: 'cached', report: existing.report as unknown as GitHubReviewReport };
    }
  }

  const fetched = await fetchGitHubSnapshot(username);
  if (!fetched.ok) {
    if (fetched.reason === 'rate_limited') return { status: 'skipped', reason: 'rate_limited' };
    if (fetched.reason === 'error') return { status: 'skipped', reason: 'fetch_error' };
    // not_found / org_account: a dead or org link IS evidence — store UNVERIFIABLE deterministically (no AI).
    const isOrg = fetched.reason === 'org_account';
    const report: GitHubReviewReport = {
      version: 1,
      username,
      url: user.githubUrl,
      activityLevel: 'dead',
      commits90d: 0,
      activeDays90d: 0,
      lastActivityAt: null,
      accountCreatedAt: '',
      publicRepos: 0,
      originalRepos: 0,
      followers: 0,
      topLanguages: [],
      stackMatch: 0,
      matchedSkills: [],
      unverifiedSkills: skills.slice(0, 30),
      flags: [isOrg ? 'org_account' : 'dead_account'],
      evidence: [isOrg
        ? 'Link points to a GitHub organization page, not a personal account'
        : 'GitHub profile not found (404) — the link on the résumé is dead or the account was renamed'],
      verdict: 'UNVERIFIABLE',
      summary: isOrg
        ? 'The provided GitHub link is an organization page, so personal work cannot be verified from it.'
        : 'The provided GitHub link does not resolve to an account, so nothing could be verified.',
    };
    await upsertReview(userId, username, report, null, stamp);
    return { status: 'done', report };
  }

  const det = computeDeterministicMetrics(fetched.snapshot);
  const ai = await assessGitHubEvidence(fetched.snapshot, {
    name: user.name,
    skills,
    title,
    experienceYears: Number(pp?.experience_years) || null,
  });
  if (!ai) return { status: 'skipped', reason: 'ai_unavailable' }; // store NOTHING on AI failure

  const { baselineFlags, ...metrics } = det;
  const report: GitHubReviewReport = {
    version: 1,
    username,
    url: user.githubUrl,
    ...metrics,
    ...ai,
    flags: [...new Set([...baselineFlags, ...ai.flags])],
  };
  await upsertReview(userId, username, report, fetched.snapshot, stamp);
  return { status: 'done', report };
}
