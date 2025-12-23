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

/**
 * Validate that a domain has a logo in Logo.dev
 * This is used to filter out fake/invalid company domains
 *
 * @param domain - The domain to validate (e.g., "company.com")
 * @returns true if Logo.dev has a logo for this domain, false otherwise
 */
export async function validateDomainHasLogo(domain: string): Promise<boolean> {
  if (!domain || domain.length < 4) return false;

  // Skip free email providers
  if (isFreeEmailDomain(domain)) return false;

  try {
    const url = `${LOGO_DEV_API}/${encodeURIComponent(domain)}?token=${LOGO_DEV_TOKEN}`;

    // Use HEAD request to check if logo exists without downloading it
    const response = await fetch(url, {
      method: 'HEAD',
      // Short timeout - we just need to know if it exists
      signal: AbortSignal.timeout(5000),
    });

    // Logo.dev returns 200 for valid logos, 404 for unknown domains
    return response.ok;
  } catch (error) {
    // Network error or timeout - assume domain is invalid
    console.log(`[Logo.dev] Validation failed for ${domain}:`, error);
    return false;
  }
}

/**
 * Validate domain from email address
 *
 * @param email - Email address to extract domain from
 * @returns true if the email domain has a valid logo, false otherwise
 */
export async function validateEmailDomainHasLogo(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;

  const domain = extractDomainFromEmail(email);
  if (!domain) return false;

  return validateDomainHasLogo(domain);
}
