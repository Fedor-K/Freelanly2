/**
 * Does this listing demand US work authorization?
 *
 * US staffing posts routinely require W2 employment, citizenship, a green card or corp-to-corp —
 * all of which are closed to an applicant without US status, whatever the cover letter says. That
 * matters here because ~99% of sends come from users outside the US and about a fifth of the feed
 * carries one of these demands, so those applications cannot succeed.
 *
 * Matched once at ingest and stored on Opportunity.requiresUsWorkAuth: running this over
 * description + originalContent across the table costs ~17 seconds, which is far too slow to
 * evaluate per request in the stats endpoint.
 *
 * Deliberately narrow. It matches explicit status demands only — not "US hours", not "US client",
 * not a US location, all of which a remote applicant abroad can satisfy. False negatives are
 * cheaper than false positives: wrongly flagging a listing hides a real opportunity from the user.
 */
const US_WORK_AUTH_RE =
  /(w-?2\b|us citizen|green card|\busc\b|corp to corp|\bc2c\b|only in the us|us[- ]based only|must be (located|based) in the (us|usa|united states))/i;

export function requiresUsWorkAuth(...parts: (string | null | undefined)[]): boolean {
  return US_WORK_AUTH_RE.test(parts.filter(Boolean).join(' '));
}
