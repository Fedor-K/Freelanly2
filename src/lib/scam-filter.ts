/**
 * Scam / predatory-"recruiter" filter.
 *
 * Some "recruiters" reply to our applications with a templated resume-rewrite upsell
 * ("Thank you for sharing your resume… I can see potential alignment… there's a high
 * chance it may not move forward… this is a paid service"). They are not hiring — they
 * harvest applicants and sell resume edits. ~6.4% of all recruiter replies were this,
 * from a handful of addresses. We block them on BOTH sides:
 *   - inbound: don't notify the user or count it as a reply (treat as SPAM)
 *   - outbound: don't apply to these addresses in the first place
 *
 * Matched by exact address, lookalike domain, OR the verbatim script phrases (so a new
 * address running the same template is still caught).
 */

// Known scam sender addresses (exact, lowercase)
const SCAM_EMAILS = new Set<string>([
  'chyintia@zohomail.com',
  'tajudeenibrahimishola@zohomail.com',
]);

// Lookalike / fake staffing domains that are all scam (NOT free-email providers —
// never list gmail/zohomail wholesale, real clients use those).
const SCAM_DOMAINS = new Set<string>([
  'employbridgeglobal.com', // lookalike of the real employbridge.com
]);

// Verbatim distinctive phrases from the resume-rewrite scam script. Specific enough that
// a genuine recruiter reply won't contain them.
const SCAM_TEXT_PATTERNS: RegExp[] = [
  /potential alignment with several opportunities/i,
  /high chance it may not move forward/i,
  /confirm a few details to ensure the best/i,
];

function bareEmail(from: string): string {
  return (from.match(/<([^>]+)>/)?.[1] || from).toLowerCase().trim();
}

/** Outbound: should we refuse to send an application to this recruiter address? */
export function isScamRecipient(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = bareEmail(email);
  if (SCAM_EMAILS.has(e)) return true;
  const domain = e.split('@')[1] || '';
  return SCAM_DOMAINS.has(domain);
}

/** Inbound: is this reply a known scam (by sender or by the template text)? */
export function isScamReply(from: string | null | undefined, text: string | null | undefined): boolean {
  if (from && isScamRecipient(from)) return true;
  if (text && SCAM_TEXT_PATTERNS.some((re) => re.test(text))) return true;
  return false;
}
