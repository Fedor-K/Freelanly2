/**
 * Lever Company Discovery Configuration
 *
 * Search queries for finding new companies on Lever via Google Search.
 * Organized by 21 job categories matching site.ts categories.
 *
 * Run weekly via Apify → webhook → /api/webhooks/lever-discovery
 */

// Search queries organized by category (21 categories)
export const LEVER_QUERIES_BY_CATEGORY: Record<string, string[]> = {
  // Tech (6 categories)
  engineering: [
    '"software engineer" site:jobs.lever.co',
    '"developer" site:jobs.lever.co',
    '"frontend engineer" site:jobs.lever.co',
    '"backend engineer" site:jobs.lever.co',
    '"fullstack" site:jobs.lever.co',
    '"mobile engineer" site:jobs.lever.co',
  ],
  design: [
    '"product designer" site:jobs.lever.co',
    '"ux designer" site:jobs.lever.co',
    '"ui designer" site:jobs.lever.co',
    '"visual designer" site:jobs.lever.co',
    '"design lead" site:jobs.lever.co',
  ],
  data: [
    '"data scientist" site:jobs.lever.co',
    '"data engineer" site:jobs.lever.co',
    '"data analyst" site:jobs.lever.co',
    '"machine learning" site:jobs.lever.co',
    '"ai engineer" site:jobs.lever.co',
  ],
  devops: [
    '"devops engineer" site:jobs.lever.co',
    '"sre" site:jobs.lever.co',
    '"platform engineer" site:jobs.lever.co',
    '"cloud engineer" site:jobs.lever.co',
    '"infrastructure engineer" site:jobs.lever.co',
  ],
  qa: [
    '"qa engineer" site:jobs.lever.co',
    '"test engineer" site:jobs.lever.co',
    '"quality assurance" site:jobs.lever.co',
    '"automation engineer" site:jobs.lever.co',
  ],
  security: [
    '"security engineer" site:jobs.lever.co',
    '"cybersecurity" site:jobs.lever.co',
    '"information security" site:jobs.lever.co',
    '"security analyst" site:jobs.lever.co',
  ],

  // Business (8 categories)
  product: [
    '"product manager" site:jobs.lever.co',
    '"product owner" site:jobs.lever.co',
    '"product lead" site:jobs.lever.co',
    '"head of product" site:jobs.lever.co',
  ],
  marketing: [
    '"marketing manager" site:jobs.lever.co',
    '"growth marketing" site:jobs.lever.co',
    '"content marketing" site:jobs.lever.co',
    '"performance marketing" site:jobs.lever.co',
    '"demand generation" site:jobs.lever.co',
  ],
  sales: [
    '"account executive" site:jobs.lever.co',
    '"sales engineer" site:jobs.lever.co',
    '"sales representative" site:jobs.lever.co',
    '"business development" site:jobs.lever.co',
    '"customer success" site:jobs.lever.co',
  ],
  finance: [
    '"financial analyst" site:jobs.lever.co',
    '"accountant" site:jobs.lever.co',
    '"controller" site:jobs.lever.co',
    '"finance manager" site:jobs.lever.co',
    '"fp&a" site:jobs.lever.co',
  ],
  hr: [
    '"recruiter" site:jobs.lever.co',
    '"talent acquisition" site:jobs.lever.co',
    '"hr manager" site:jobs.lever.co',
    '"people operations" site:jobs.lever.co',
    '"hr business partner" site:jobs.lever.co',
  ],
  operations: [
    '"operations manager" site:jobs.lever.co',
    '"operations analyst" site:jobs.lever.co',
    '"business operations" site:jobs.lever.co',
    '"revenue operations" site:jobs.lever.co',
  ],
  legal: [
    '"legal counsel" site:jobs.lever.co',
    '"attorney" site:jobs.lever.co',
    '"paralegal" site:jobs.lever.co',
    '"contracts manager" site:jobs.lever.co',
    '"compliance" site:jobs.lever.co',
  ],
  'project-management': [
    '"project manager" site:jobs.lever.co',
    '"program manager" site:jobs.lever.co',
    '"scrum master" site:jobs.lever.co',
    '"delivery manager" site:jobs.lever.co',
  ],

  // Content & Creative (3 categories)
  writing: [
    '"content writer" site:jobs.lever.co',
    '"copywriter" site:jobs.lever.co',
    '"technical writer" site:jobs.lever.co',
    '"content strategist" site:jobs.lever.co',
    '"editor" site:jobs.lever.co',
  ],
  translation: [
    '"translator" site:jobs.lever.co',
    '"localization" site:jobs.lever.co',
    '"interpreter" site:jobs.lever.co',
    '"localization manager" site:jobs.lever.co',
    '"language specialist" site:jobs.lever.co',
  ],
  creative: [
    '"video editor" site:jobs.lever.co',
    '"motion designer" site:jobs.lever.co',
    '"animator" site:jobs.lever.co',
    '"creative director" site:jobs.lever.co',
    '"multimedia" site:jobs.lever.co',
  ],

  // Other (4 categories)
  support: [
    '"customer support" site:jobs.lever.co',
    '"customer service" site:jobs.lever.co',
    '"support engineer" site:jobs.lever.co',
    '"technical support" site:jobs.lever.co',
  ],
  education: [
    '"instructional designer" site:jobs.lever.co',
    '"training specialist" site:jobs.lever.co',
    '"learning" site:jobs.lever.co',
    '"curriculum" site:jobs.lever.co',
  ],
  research: [
    '"researcher" site:jobs.lever.co',
    '"ux researcher" site:jobs.lever.co',
    '"user researcher" site:jobs.lever.co',
    '"research scientist" site:jobs.lever.co',
  ],
  consulting: [
    '"consultant" site:jobs.lever.co',
    '"solutions architect" site:jobs.lever.co',
    '"implementation" site:jobs.lever.co',
    '"professional services" site:jobs.lever.co',
  ],
};

// Flat list of all queries (for backward compatibility)
export const LEVER_SEARCH_QUERIES = Object.values(LEVER_QUERIES_BY_CATEGORY).flat();

// Get queries for specific category
export function getQueriesForCategory(category: string): string[] {
  return LEVER_QUERIES_BY_CATEGORY[category] || [];
}

// Get all queries as newline-separated string (for Apify input)
export function getAllQueriesAsString(): string {
  return LEVER_SEARCH_QUERIES.join('\n');
}

// Get queries for specific categories as string
export function getQueriesAsString(categories: string[]): string {
  return categories
    .flatMap((cat) => LEVER_QUERIES_BY_CATEGORY[cat] || [])
    .join('\n');
}

/**
 * Extract company slug from Lever job URL
 * Examples:
 *   https://jobs.lever.co/stripe/abc123 → "stripe"
 *   https://jobs.lever.co/figma/xyz789?lever-origin=applied → "figma"
 */
export function extractLeverSlug(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Must be jobs.lever.co
    if (!parsed.hostname.includes('lever.co')) {
      return null;
    }

    // Path format: /{company-slug}/{job-id} or /{company-slug}
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 1) {
      const slug = pathParts[0].toLowerCase();

      // Skip generic/invalid slugs
      if (slug.length < 2 || slug === 'jobs' || slug === 'apply') {
        return null;
      }

      return slug;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Extract unique company slugs from array of URLs
 */
export function extractUniqueSlugs(urls: string[]): string[] {
  const slugs = new Set<string>();

  for (const url of urls) {
    const slug = extractLeverSlug(url);
    if (slug) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs).sort();
}
