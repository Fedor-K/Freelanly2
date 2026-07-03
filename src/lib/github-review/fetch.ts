// GitHub REST fetcher — exactly 3 requests per user (profile, repos, public events). Plain fetch
// (repo convention — no octokit), optional GITHUB_TOKEN (5k req/hr authed vs 60 anonymous).
// Fail-soft: any non-OK outcome maps to a typed reason; rate-limit is surfaced so callers STOP
// instead of burning the remaining quota.

import type { GitHubSnapshot } from './types';

const API = 'https://api.github.com';
const TIMEOUT_MS = 15000;

export type FetchResult =
  | { ok: true; snapshot: GitHubSnapshot }
  | { ok: false; reason: 'not_found' | 'org_account' | 'rate_limited' | 'error' };

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'freelanly-verification',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

function isRateLimited(res: Response): boolean {
  return (res.status === 403 || res.status === 429) && res.headers.get('x-ratelimit-remaining') === '0';
}

async function ghGet(path: string): Promise<{ status: number; rateLimited: boolean; json: unknown | null }> {
  const res = await fetch(`${API}${path}`, { headers: ghHeaders(), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (isRateLimited(res)) return { status: res.status, rateLimited: true, json: null };
  if (!res.ok) return { status: res.status, rateLimited: false, json: null };
  return { status: res.status, rateLimited: false, json: await res.json() };
}

export async function fetchGitHubSnapshot(username: string): Promise<FetchResult> {
  try {
    const prof = await ghGet(`/users/${encodeURIComponent(username)}`);
    if (prof.rateLimited) return { ok: false, reason: 'rate_limited' };
    if (prof.status === 404) return { ok: false, reason: 'not_found' };
    if (!prof.json) return { ok: false, reason: 'error' };
    const p = prof.json as Record<string, unknown>;
    if (p.type === 'Organization') return { ok: false, reason: 'org_account' };

    const [reposRes, eventsRes] = await Promise.all([
      ghGet(`/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=100&type=owner`),
      ghGet(`/users/${encodeURIComponent(username)}/events/public?per_page=100`),
    ]);
    if (reposRes.rateLimited || eventsRes.rateLimited) return { ok: false, reason: 'rate_limited' };
    const reposRaw = (reposRes.json as Record<string, unknown>[] | null) || [];
    const eventsRaw = (eventsRes.json as Record<string, unknown>[] | null) || [];

    const repos = reposRaw.slice(0, 30).map(r => ({
      name: String(r.name || ''),
      language: (r.language as string | null) ?? null,
      fork: Boolean(r.fork),
      stars: Number(r.stargazers_count) || 0,
      pushedAt: String(r.pushed_at || ''),
      createdAt: String(r.created_at || ''),
      description: (r.description as string | null) ?? null,
      sizeKb: Number(r.size) || 0,
    }));

    // Language mix over ALL fetched non-fork repos (not just top 30), by repo count.
    const langCounts: Record<string, number> = {};
    let langTotal = 0;
    for (const r of reposRaw) {
      if (r.fork || !r.language) continue;
      const lang = String(r.language);
      langCounts[lang] = (langCounts[lang] || 0) + 1;
      langTotal++;
    }
    const languages = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([lang, repoCount]) => ({ lang, repoCount, pct: Math.round((repoCount / Math.max(1, langTotal)) * 100) }));

    const cutoff = Date.now() - 90 * 864e5;
    const recent = eventsRaw.filter(e => new Date(String(e.created_at || 0)).getTime() >= cutoff);
    const pushEvents = recent.filter(e => e.type === 'PushEvent');
    const commitsEstimate90d = pushEvents.reduce((s, e) => {
      const payload = e.payload as Record<string, unknown> | undefined;
      return s + (Number(payload?.size) || 0);
    }, 0);
    const activeDays90d = new Set(recent.map(e => String(e.created_at || '').slice(0, 10))).size;

    const snapshot: GitHubSnapshot = {
      username,
      profile: {
        name: (p.name as string | null) ?? null,
        bio: (p.bio as string | null) ?? null,
        company: (p.company as string | null) ?? null,
        location: (p.location as string | null) ?? null,
        blog: (p.blog as string | null) ?? null,
        type: 'User',
        createdAt: String(p.created_at || ''),
        followers: Number(p.followers) || 0,
        publicRepos: Number(p.public_repos) || 0,
      },
      repos,
      languages,
      activity: {
        events90d: recent.length,
        pushEvents90d: pushEvents.length,
        commitsEstimate90d,
        activeDays90d,
        prEvents90d: recent.filter(e => e.type === 'PullRequestEvent').length,
        lastEventAt: eventsRaw.length ? String(eventsRaw[0].created_at || '') : null,
      },
      fetchedAt: new Date().toISOString(),
    };
    return { ok: true, snapshot };
  } catch (e) {
    console.error(`[GitHubReview] fetch failed for ${username}:`, e instanceof Error ? e.message : e);
    return { ok: false, reason: 'error' };
  }
}
