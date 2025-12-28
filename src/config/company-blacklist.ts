/**
 * Company Blacklist
 *
 * Companies in this list will be skipped during job import.
 * Add company slugs (from Lever URL) or name patterns.
 */

// Exact slugs to block (from jobs.lever.co/{slug})
export const BLOCKED_COMPANY_SLUGS = new Set([
  'saronic',  // Saronic Technologies - defense/military, non-remote
]);

// Name patterns to block (case-insensitive partial match)
export const BLOCKED_COMPANY_PATTERNS = [
  'saronic',
];

/**
 * Check if a company should be blocked
 */
export function isBlockedCompany(slug: string, name?: string): boolean {
  const normalizedSlug = slug.toLowerCase();

  // Check exact slug match
  if (BLOCKED_COMPANY_SLUGS.has(normalizedSlug)) {
    return true;
  }

  // Check slug patterns
  for (const pattern of BLOCKED_COMPANY_PATTERNS) {
    if (normalizedSlug.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check name patterns
  if (name) {
    const normalizedName = name.toLowerCase();
    for (const pattern of BLOCKED_COMPANY_PATTERNS) {
      if (normalizedName.includes(pattern.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}
