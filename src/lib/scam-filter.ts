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
  /may not move forward/i,                                  // broadened from "high chance it may not move forward"
  /confirm a few details to ensure the best/i,
  /based on your (experience|background)[\s\S]{0,40}\bpotential\b/i, // the scam opener variants
  /i want to be transparent with you/i,                     // the resume-rewrite pivot line
  /(this service|the service|it) (typically )?involves a fee/i, // the upsell ask (recruiters never charge candidates)
  // Web3/crypto "earn tokens for your activity" recruiting — a platform harvesting users
  // with crypto rewards, not a real client hiring. Kept specific so a genuine crypto job
  // (paid in salary) still passes; only the reward/token-for-activity framing trips it.
  /\bHIVE tokens?\b/i,
  /cryptocurrency rewards?/i,
  /earn (crypto|cryptocurrency|hive)\w*\s+(rewards?|tokens?)/i,
  // Off-platform pull: "your application came through an aggregator — let me route you
  // directly into our official/internal system" (drags the user off-platform; the example
  // user naively overshared their personal email). NOTE: may also catch a few legit ATS
  // redirects — acceptable per product call to stop the off-platform leak.
  /processed through (a |an )?(partner )?aggregator/i,
  /route you (directly )?(in)?to (our )?(official|internal|main)\b/i,
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
