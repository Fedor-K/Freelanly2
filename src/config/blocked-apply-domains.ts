// Global blocklist of recruiter/apply emails we refuse to import or send to.
// - BLOCKED_APPLY_DOMAINS: bare domains (e.g. 'univar.in'); case-insensitive, covers subdomains.
// - BLOCKED_APPLY_EMAILS: specific full addresses — for spammers on a free domain we can't block
//   wholesale (e.g. a gmail résumé-farm). Lowercased exact match.
// Used at import (linkedin-posts webhook), in the auto-apply matcher/sender, and in quick-apply.
export const BLOCKED_APPLY_DOMAINS: string[] = [
  'univar.in',
  'zohomail.com',
  'kloudhire.com',
  'allyted.com', // staffing mill: replies to every candidate with a "fill this Google form" lead-farm, not a real conversation — blocked 2026-06-16
];

export const BLOCKED_APPLY_EMAILS: string[] = [
  'hivepostifyofficial@gmail.com', // résumé-farm spammer ("HivePostify: We selected you…") — purged 2026-06-10
  'impact.recruiting.org@gmail.com', // résumé-farm ("Neuberg Stewart": batch "Congratulations" templates 27d later, salary/PII harvesting) — purged 2026-06-12
];

export function isBlockedApplyEmail(email?: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase().trim();
  if (BLOCKED_APPLY_EMAILS.includes(e)) return true;
  const at = e.lastIndexOf('@');
  if (at === -1) return false;
  const domain = e.slice(at + 1);
  return BLOCKED_APPLY_DOMAINS.some((d) => domain === d || domain.endsWith('.' + d));
}
