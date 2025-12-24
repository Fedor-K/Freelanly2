/**
 * Masks URLs in text for non-PRO users
 * Replaces links with "[Upgrade to PRO to see link]"
 */

// Common URL patterns in job posts
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

// Email pattern
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

/**
 * Masks URLs and emails in text for FREE users
 * PRO users see the original text
 */
export function maskLinksForFreeUsers(
  text: string | null,
  userPlan: 'FREE' | 'PRO' | 'ENTERPRISE'
): string {
  if (!text) return '';

  // PRO and ENTERPRISE users see everything
  if (userPlan === 'PRO' || userPlan === 'ENTERPRISE') {
    return text;
  }

  // FREE users: mask URLs and emails
  let maskedText = text;

  // Mask URLs
  maskedText = maskedText.replace(URL_REGEX, '[Upgrade to PRO to see link]');

  // Mask emails
  maskedText = maskedText.replace(EMAIL_REGEX, '[Upgrade to PRO to see contact]');

  return maskedText;
}

/**
 * Checks if text contains URLs that would be hidden for FREE users
 */
export function hasHiddenContent(text: string | null): boolean {
  if (!text) return false;
  return URL_REGEX.test(text) || EMAIL_REGEX.test(text);
}
