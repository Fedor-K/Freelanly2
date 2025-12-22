/**
 * Company Logo Utility with Logo.dev Fallback
 *
 * Priority:
 * 1. Apollo logo (from enrichment)
 * 2. Logo.dev API (if domain available) - high quality company logos
 * 3. null (show placeholder)
 */

// Logo.dev API (former Clearbit) - returns high quality company logos
const LOGO_DEV_API = 'https://img.logo.dev';
const LOGO_DEV_TOKEN = 'pk_A6k2yPZ4T6y5MZrbuUd9yA';

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

// Free email providers that shouldn't be used for logos
const FREE_EMAIL_PROVIDERS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'live.com',
  'icloud.com', 'me.com', 'mac.com', 'aol.com', 'protonmail.com',
  'mail.com', 'yandex.com', 'zoho.com',
]);

function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_PROVIDERS.has(domain.toLowerCase());
}

/**
 * Get Logo.dev URL for a domain
 * @param domain - The domain to get logo for
 * @param size - Icon size (optional)
 */
export function getLogoDevUrl(domain: string, size?: number): string {
  let url = `${LOGO_DEV_API}/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}`;
  if (size) {
    url += `&size=${size}`;
  }
  return url;
}

/**
 * Get company logo URL with fallback to Logo.dev
 *
 * @param logo - Company's logo URL (from Apollo enrichment)
 * @param website - Company's website URL
 * @param email - Contact email (to extract domain)
 * @param size - Logo size if using fallback (optional)
 * @returns Logo URL or null if no fallback available
 */
export function getCompanyLogoUrl(
  logo: string | null | undefined,
  website?: string | null,
  email?: string | null,
  size?: number
): string | null {
  // 1. Use Apollo logo if available (non-empty string)
  if (logo && logo.length > 0) {
    return logo;
  }

  // 2. Try to get domain from website
  const websiteDomain = extractDomainFromUrl(website);
  if (websiteDomain) {
    return getLogoDevUrl(websiteDomain, size);
  }

  // 3. Try to get domain from email (if not free email)
  const emailDomain = extractDomainFromEmail(email);
  if (emailDomain && !isFreeEmailDomain(emailDomain)) {
    return getLogoDevUrl(emailDomain, size);
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
