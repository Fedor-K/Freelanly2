// Pure helpers to pull a GitHub username out of free text (resumeText) or a candidate-entered URL
// (portfolioUrl / settings input). No deps, no I/O — unit-testable in isolation.

// First path segment after github.com/, excluding gists. GitHub usernames: alphanumeric + hyphens,
// max 39 chars, must start alphanumeric. The charset excludes '.', so trailing punctuation in prose
// ("github.com/user." / "…user,") terminates the match naturally.
const GH_RE = /(?<!gist\.)github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))/gi;

// Reserved first-path-segments that are github.com pages, not user profiles.
const RESERVED = new Set([
  'orgs', 'sponsors', 'features', 'topics', 'collections', 'marketplace', 'apps', 'about',
  'pricing', 'search', 'explore', 'trending', 'settings', 'login', 'join', 'blog', 'contact',
  'enterprise', 'site', 'security', 'readme', 'events', 'notifications', 'issues', 'pulls',
  'new', 'organizations', 'dashboard', 'codespaces', 'copilot',
]);

/** All distinct usernames found across the given texts, in order of appearance, lowercased. */
export function extractGitHubUsernames(...texts: Array<string | null | undefined>): string[] {
  const found: string[] = [];
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.matchAll(GH_RE)) {
      const u = m[1].toLowerCase();
      if (RESERVED.has(u) || found.includes(u)) continue;
      found.push(u);
    }
  }
  return found;
}

/** Username from a single URL-ish string — null unless it contains exactly a github.com profile path. */
export function usernameFromGitHubUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const [first] = extractGitHubUsernames(url);
  return first || null;
}

/** First discoverable GitHub profile across the given texts (earlier args win — pass the
 *  explicit candidate-entered source first), normalized to https://github.com/<username>. */
export function firstGitHubUrlFrom(...texts: Array<string | null | undefined>): string | null {
  for (const t of texts) {
    const [u] = extractGitHubUsernames(t);
    if (u) return `https://github.com/${u}`;
  }
  return null;
}
