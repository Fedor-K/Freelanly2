/**
 * Escape text for safe interpolation into an HTML email body.
 *
 * Auto-apply cover letters are AI-generated from scraped job posts + résumés, so
 * raw `<...>` from that content must not pass through into the HTML we send from
 * apply@freelanly.com (HTML/markup injection, broken layout, phishing-link smuggling).
 * Cover letters are plain text with line breaks — escaping preserves their meaning
 * while neutralizing any embedded markup.
 */
export function escapeHtml(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
