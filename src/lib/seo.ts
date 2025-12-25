/**
 * SEO utilities for consistent metadata across all pages.
 *
 * IMPORTANT: All dynamic pages MUST use these utilities for title generation
 * to ensure SEO compliance (max 60 characters for titles).
 */

/** Maximum length for SEO page titles (Google recommendation) */
export const SEO_TITLE_MAX_LENGTH = 60;

/** Maximum length for meta descriptions */
export const SEO_DESCRIPTION_MAX_LENGTH = 155;

/**
 * Truncates a title to SEO-friendly length (max 60 chars).
 * If truncation is needed, adds "..." suffix.
 *
 * @example
 * truncateTitle("Very Long Company Name Remote Jobs - Work at Very Long Company Name")
 * // Returns: "Very Long Company Name Remote Jobs - Work..."
 *
 * @param title - The full title to truncate
 * @param maxLength - Maximum length (default: 60)
 * @returns Truncated title with "..." if needed
 */
export function truncateTitle(title: string, maxLength = SEO_TITLE_MAX_LENGTH): string {
  if (title.length <= maxLength) {
    return title;
  }
  return title.slice(0, maxLength - 3).trimEnd() + '...';
}

/**
 * Truncates a description to SEO-friendly length (max 155 chars).
 *
 * @param description - The full description to truncate
 * @param maxLength - Maximum length (default: 155)
 * @returns Truncated description
 */
export function truncateDescription(description: string, maxLength = SEO_DESCRIPTION_MAX_LENGTH): string {
  if (description.length <= maxLength) {
    return description;
  }
  return description.slice(0, maxLength - 3).trimEnd() + '...';
}

/**
 * Builds a page title from parts and ensures it's SEO-compliant.
 * Automatically truncates if the combined title exceeds max length.
 *
 * @example
 * buildPageTitle(["Senior Engineering Jobs", "Freelanly"])
 * // Returns: "Senior Engineering Jobs | Freelanly"
 *
 * buildPageTitle(["Very Long Job Title Here", "Very Long Company Name"], " at ")
 * // Returns: "Very Long Job Title Here at Ve..."
 *
 * @param parts - Array of title parts to join
 * @param separator - Separator between parts (default: " | ")
 * @returns SEO-compliant title (max 60 chars)
 */
export function buildPageTitle(parts: string[], separator = ' | '): string {
  const fullTitle = parts.filter(Boolean).join(separator);
  return truncateTitle(fullTitle);
}

/**
 * Generates consistent metadata for job-related pages.
 * Use this as a template for creating page metadata.
 */
export interface PageMetadataOptions {
  title: string;
  description: string;
  url: string;
  keywords?: string[];
  noIndex?: boolean;
}

/**
 * Helper to create a short version of title for truncation fallback.
 * Removes the suffix part after the separator if the title is too long.
 *
 * @example
 * createShortTitle("Company Name Remote Jobs - Work at Company Name", " - ")
 * // Returns: "Company Name Remote Jobs"
 */
export function createShortTitle(fullTitle: string, separator: string): string {
  const parts = fullTitle.split(separator);
  if (parts.length > 1) {
    return truncateTitle(parts[0]);
  }
  return truncateTitle(fullTitle);
}
