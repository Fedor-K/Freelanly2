/**
 * Strip quoted reply history ("On … wrote: > …"), signatures, MIME boundaries/headers,
 * GDPR disclaimers, CID refs and HTML-entity cruft from an inbound email body so it renders
 * as a clean chat message. Isomorphic (pure string ops) — safe on server or client.
 * Mirrors the cleaning the candidate inbox already does; no-op on already-clean composed text.
 */
export function cleanReplyText(text: string | null | undefined): string {
  let cleaned = text || '';
  // MIME boundaries (--_000_XXX…)
  cleaned = cleaned.replace(/--_\w+[\w._-]*_?\s*/g, '').trim();
  cleaned = cleaned.replace(/--\w{20,}\s*/g, '').trim();
  // Quoted original message (On … wrote: …)
  cleaned = cleaned.replace(/On\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun|[\d]{1,2})[\s\S]*?wrote:[\s\S]*/i, '').trim();
  // Signatures after -- or __
  cleaned = cleaned.replace(/\n--\s*\n[\s\S]*/m, '').trim();
  cleaned = cleaned.replace(/\n__+\s*\n[\s\S]*/m, '').trim();
  // Disclaimer blocks
  cleaned = cleaned.replace(/This email may contain[\s\S]*/i, '').trim();
  cleaned = cleaned.replace(/CONFIDENTIAL[\s\S]*/i, '').trim();
  // HTML entity leftovers
  cleaned = cleaned.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // Bracketed URLs, content-type headers, CID refs, mailto links
  cleaned = cleaned.replace(/<https?:\/\/[^>]+>/g, '');
  cleaned = cleaned.replace(/Content-Type:[\s\S]*?\n\n/gi, '').trim();
  cleaned = cleaned.replace(/\[cid:[^\]]*\](\[X\])?/g, '').trim();
  cleaned = cleaned.replace(/<mailto:[^>]+>/g, '').trim();
  // Collapse excess blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
}
