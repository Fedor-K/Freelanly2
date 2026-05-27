// Global blocklist of recruiter/apply email domains we refuse to import or send to.
// Add a bare domain (e.g. 'univar.in'); matching is case-insensitive and covers
// subdomains. Used at import (linkedin-posts webhook) AND in the auto-apply sender.
export const BLOCKED_APPLY_DOMAINS: string[] = [
  'univar.in',
];

export function isBlockedApplyEmail(email?: string | null): boolean {
  if (!email) return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();
  return BLOCKED_APPLY_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
}
