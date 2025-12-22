/**
 * Company Logo Utility with Google Favicon Fallback
 *
 * Priority:
 * 1. Apollo logo (from enrichment)
 * 2. Google Favicon API (if domain available)
 * 3. null (show placeholder)
 */

// Google Favicon API - returns high quality favicons
const GOOGLE_FAVICON_API = 'https://www.google.com/s2/favicons';

// Extract domain from URL
function extractDomainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

// Extract domain from email
function extractDomainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const match = email.match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})$/);
  return match ? match[1].toLowerCase() : null;
}

// Free email providers that shouldn't be used for favicons
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com',
  'mail.com', 'yandex.com', 'zoho.com',
]);

function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_PROVIDERS.has(domain.toLowerCase());
}

/**
 * Get Google Favicon URL for a domain
 * @param domain - The domain to get favicon for
 * @param size - Icon size (16, 32, 64, 128, 256)
 */
export function getGoogleFaviconUrl(domain: string, size: number = 128): string {
  return `${GOOGLE_FAVICON_API}?domain=${encodeURIComponent(domain)}&sz=${size}`;
}

/**
 * Get company logo URL with fallback to Google Favicon
 *
 * @param logo - Company's logo URL (from Apollo enrichment)
 * @param website - Company's website URL
 * @param email - Contact email (to extract domain)
 * @param size - Favicon size if using fallback
 * @returns Logo URL or null if no fallback available
 */
export function getCompanyLogoUrl(
  logo: string | null | undefined,
  website?: string | null,
  email?: string | null,
  size: number = 128
): string | null {
  // 1. Use Apollo logo if available (non-empty string)
  if (logo && logo.length > 0) {
    return logo;
  }

  // 2. Try to get domain from website
  const websiteDomain = extractDomainFromUrl(website);
  if (websiteDomain) {
    return getGoogleFaviconUrl(websiteDomain, size);
  }

  // 3. Try to get domain from email (if not free email)
  const emailDomain = extractDomainFromEmail(email);
  if (emailDomain && !isFreeEmailDomain(emailDomain)) {
    return getGoogleFaviconUrl(emailDomain, size);
  }

  // 4. No fallback available
  return null;
}

/**
 * Check if we should show a placeholder instead of logo
 */
export function shouldShowPlaceholder(
  logo: string | null | undefined,
  website?: string | null,
  email?: string | null
): boolean {
  return getCompanyLogoUrl(logo, website, email) === null;
}
