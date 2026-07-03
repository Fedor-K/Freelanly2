// GitHub evidence types (verification Tier 1). The report is split into a DETERMINISTIC half
// (computed in code from the API snapshot — numbers the AI cannot hallucinate) and an AI-judged
// half (stack match vs claimed skills, flags, verdict). `version` guards future shape changes.

export type GitHubSnapshot = {
  username: string;
  profile: {
    name: string | null;
    bio: string | null;
    company: string | null;
    location: string | null;
    blog: string | null;
    type: 'User' | 'Organization';
    createdAt: string;
    followers: number;
    publicRepos: number;
  };
  // top repos by pushed_at (owner repos only, max 30)
  repos: Array<{
    name: string;
    language: string | null;
    fork: boolean;
    stars: number;
    pushedAt: string;
    createdAt: string;
    description: string | null;
    sizeKb: number;
  }>;
  // share of non-fork repos per language (repo-count %, not bytes — good enough for evidence)
  languages: Array<{ lang: string; repoCount: number; pct: number }>;
  activity: {
    events90d: number;
    pushEvents90d: number;
    commitsEstimate90d: number; // Σ payload.size over PushEvents — a FLOOR (public API keeps ~90d/300 events)
    activeDays90d: number;      // distinct days with any public event
    prEvents90d: number;
    lastEventAt: string | null;
  };
  fetchedAt: string;
};

export type GitHubReviewVerdict = 'STRONG' | 'ACTIVE' | 'WEAK' | 'INACTIVE' | 'MISMATCH' | 'UNVERIFIABLE';

export type GitHubReviewFlag =
  | 'all_forks'        // has public repos but zero original ones
  | 'tutorial_clones'  // originals look like course/tutorial copies (AI-judged)
  | 'dead_account'     // no public activity, nothing pushed in 12mo (or 404 link)
  | 'name_mismatch'    // github identity doesn't plausibly match the claimed name
  | 'profile_mismatch' // account exists but clearly isn't this person's work profile
  | 'org_account'      // link points to an organization page, not a user
  | 'empty_account'    // zero public repos
  | 'new_account';     // created <6 months ago

export type GitHubReviewReport = {
  version: 1;
  username: string;
  url: string;
  // deterministic (computed in code):
  activityLevel: 'active' | 'moderate' | 'dormant' | 'dead';
  commits90d: number;
  activeDays90d: number;
  lastActivityAt: string | null;
  accountCreatedAt: string;
  publicRepos: number;
  originalRepos: number;
  followers: number;
  topLanguages: Array<{ lang: string; pct: number }>;
  // AI judgement:
  stackMatch: number;          // 0-100 vs claimed skills
  matchedSkills: string[];     // claimed skills with visible repo/language evidence
  unverifiedSkills: string[];  // claimed, no public evidence — NEUTRAL, not negative
  flags: GitHubReviewFlag[];
  evidence: string[];          // 3-6 render-ready lines
  verdict: GitHubReviewVerdict;
  summary: string;             // 1-2 sentences for the shortlist card
};
