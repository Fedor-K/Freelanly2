// Shared types + pure helpers for the recruiter cabinet (the /r/[token] portal).
// All UI is English-only by product rule.

export type Strength = 'Strong' | 'Good' | 'Weak' | null;

export type MatchLine = {
  label: string;
  type: 'skill' | 'language';
  status: 'full' | 'missing';
  evidence: string | null;
};

export type RecruiterCandidate = {
  appId: string;
  name: string;
  jobTitle: string;
  createdAt: string;
  fit: string | null;          // human label, e.g. "Strong" or "85% match"
  score: number | null;        // 0-100 numeric match score (drives the fit ring)
  strength?: Strength;
  caveats?: string[];
  coverLetter: string;
  cvUrl: string | null;
  lastActiveAt: string | null;
  listingKey: string;          // same vacancy groups together
  status: string;              // AutoApplyStatus — drives the intent pill
  repliedAt: string | null;    // candidate replied → lives in Conversations
  replyPreview: string | null; // last candidate reply, cleaned (conversation list preview)
  matchBreakdown?: {
    matched: number;
    total: number;
    lines: MatchLine[];
  };
  profile: {
    current_title?: string;
    experience_years?: number;
    timezone?: string;
    availabilityHours?: string;
    rateFloorHourly?: number;
    summary?: string;
    location?: string;
    languages?: string[];
    skills?: string[];
    availableFrom?: string;
    portfolioUrl?: string;
    salaryExpectation?: string;
    salaryExpectationAt?: string;
  };
};

export type RecruiterInfo = {
  name: string;
  company: string;
  email: string;
  plan: 'free' | 'pro';
};

export type Msg = { from: string; text: string; at: string };

// Avatar palette — matches the designer's RData.AV order so colours line up with the prototype.
export const AV_COLORS = ['#C7F94A', '#FF6B6B', '#6EE7FF', '#FFB951', '#A78BFA', '#34D399', '#F472B6', '#A8E024'];
export const avColor = (i: number) => AV_COLORS[i % AV_COLORS.length];

export const FREE_REVEAL_QUOTA = 2;

export function strengthClass(s: Strength): string {
  return s === 'Strong' ? 'match-strong' : s === 'Good' ? 'match-good' : 'match-weak';
}

// Fit-ring stroke colour by strength (CSS vars from design-app.css).
export function ringColor(s: Strength): string {
  return s === 'Strong' ? 'var(--acid-deep)' : s === 'Good' ? 'var(--info)' : 'var(--ink-4)';
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || parts[0]?.[1] || '')).toUpperCase() || '?';
}

// Title-case ALL-CAPS skill chips (keep ≤4-char acronyms: SAP, AWS, SQL, KPI).
export function tidySkill(s: string): string {
  return s.split(/\s+/).map((w) => (w.length <= 4 || w !== w.toUpperCase() ? w : w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
}

export function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

export function shortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Some candidates type their name letter-spaced — "M A R I A   A L E X S A N D R A".
// Detect that (many single-char tokens) and collapse it back to words, using runs of 2+ spaces
// as the word boundary the typist left between words. Normal names — including ALL-CAPS ones
// like "HÉCTOR GONZÁLEZ VILLEGAS" or short initials like "J R Smith" — are returned untouched.
export function cleanDisplayName(raw: string): string {
  const name = (raw || '').trim();
  if (!name) return raw;
  const tokens = name.split(/\s+/);
  const singles = tokens.filter((t) => t.length === 1).length;
  if (singles < 6 || singles / tokens.length < 0.7) return raw; // not letter-spaced → leave alone
  // recover words from 2+-space gaps; within a word, glue the single letters together
  const words = name.split(/\s{2,}/).map((chunk) => chunk.replace(/\s+/g, '')).filter(Boolean);
  const recovered = words.length > 1 ? words : [tokens.join('')]; // no gaps → single best-effort word
  return recovered.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// Honest liveness: only when the candidate genuinely logged in recently (≤7d). Else null → hide.
export function freshness(iso: string | null): { label: string; color: string } | null {
  if (!iso) return null;
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h > 24 * 7) return null;
  const ago = h < 1 ? 'just now' : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
  if (h <= 72) return { label: `Active ${ago}`, color: h < 24 ? '#2e7d32' : '#b07d00' };
  return { label: `Active ${ago}`, color: '#6b7280' };
}

// AutoApplyStatus → conversation intent pill (interview / interested / new).
export function intentOf(status: string, repliedAt: string | null): 'interview' | 'interested' | 'new' {
  const s = (status || '').toUpperCase();
  if (s === 'INTERVIEW' || s === 'OFFER') return 'interview';
  if (s === 'REPLIED' || repliedAt) return 'interested';
  return 'new';
}

// Primary language label, trimmed of the "(native)" qualifier for the compact role line.
export function primaryLang(langs?: string[]): string | null {
  const l = langs && langs[0];
  return l ? l.replace(/\s*\(.*\)\s*/, '').trim() : null;
}
