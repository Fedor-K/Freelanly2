/**
 * Greenhouse Company Discovery Configuration
 *
 * Search queries for finding new companies on Greenhouse via Google Search.
 * Organized by 21 job categories matching site.ts categories.
 *
 * Run weekly via Apify → /api/cron/discover-greenhouse
 */

// Search queries organized by category (21 categories)
export const GREENHOUSE_QUERIES_BY_CATEGORY: Record<string, string[]> = {
  // Tech (6 categories)
  engineering: [
    '"software engineer" site:boards.greenhouse.io',
    '"developer" site:boards.greenhouse.io',
    '"frontend engineer" site:boards.greenhouse.io',
    '"backend engineer" site:boards.greenhouse.io',
    '"fullstack" site:boards.greenhouse.io',
    '"mobile engineer" site:boards.greenhouse.io',
  ],
  design: [
    '"product designer" site:boards.greenhouse.io',
    '"ux designer" site:boards.greenhouse.io',
    '"ui designer" site:boards.greenhouse.io',
    '"visual designer" site:boards.greenhouse.io',
    '"design lead" site:boards.greenhouse.io',
  ],
  data: [
    '"data scientist" site:boards.greenhouse.io',
    '"data engineer" site:boards.greenhouse.io',
    '"data analyst" site:boards.greenhouse.io',
    '"machine learning" site:boards.greenhouse.io',
    '"ai engineer" site:boards.greenhouse.io',
  ],
  devops: [
    '"devops engineer" site:boards.greenhouse.io',
    '"sre" site:boards.greenhouse.io',
    '"platform engineer" site:boards.greenhouse.io',
    '"cloud engineer" site:boards.greenhouse.io',
    '"infrastructure engineer" site:boards.greenhouse.io',
  ],
  qa: [
    '"qa engineer" site:boards.greenhouse.io',
    '"test engineer" site:boards.greenhouse.io',
    '"quality assurance" site:boards.greenhouse.io',
    '"automation engineer" site:boards.greenhouse.io',
  ],
  security: [
    '"security engineer" site:boards.greenhouse.io',
    '"cybersecurity" site:boards.greenhouse.io',
    '"information security" site:boards.greenhouse.io',
    '"security analyst" site:boards.greenhouse.io',
  ],

  // Business (8 categories)
  product: [
    '"product manager" site:boards.greenhouse.io',
    '"product owner" site:boards.greenhouse.io',
    '"product lead" site:boards.greenhouse.io',
    '"head of product" site:boards.greenhouse.io',
  ],
  marketing: [
    '"marketing manager" site:boards.greenhouse.io',
    '"growth marketing" site:boards.greenhouse.io',
    '"content marketing" site:boards.greenhouse.io',
    '"performance marketing" site:boards.greenhouse.io',
    '"demand generation" site:boards.greenhouse.io',
  ],
  sales: [
    '"account executive" site:boards.greenhouse.io',
    '"sales engineer" site:boards.greenhouse.io',
    '"sales representative" site:boards.greenhouse.io',
    '"business development" site:boards.greenhouse.io',
    '"customer success" site:boards.greenhouse.io',
  ],
  finance: [
    '"financial analyst" site:boards.greenhouse.io',
    '"accountant" site:boards.greenhouse.io',
    '"controller" site:boards.greenhouse.io',
    '"finance manager" site:boards.greenhouse.io',
    '"fp&a" site:boards.greenhouse.io',
  ],
  hr: [
    '"recruiter" site:boards.greenhouse.io',
    '"talent acquisition" site:boards.greenhouse.io',
    '"hr manager" site:boards.greenhouse.io',
    '"people operations" site:boards.greenhouse.io',
    '"hr business partner" site:boards.greenhouse.io',
  ],
  operations: [
    '"operations manager" site:boards.greenhouse.io',
    '"operations analyst" site:boards.greenhouse.io',
    '"business operations" site:boards.greenhouse.io',
    '"revenue operations" site:boards.greenhouse.io',
  ],
  legal: [
    '"legal counsel" site:boards.greenhouse.io',
    '"attorney" site:boards.greenhouse.io',
    '"paralegal" site:boards.greenhouse.io',
    '"contracts manager" site:boards.greenhouse.io',
    '"compliance" site:boards.greenhouse.io',
  ],
  'project-management': [
    '"project manager" site:boards.greenhouse.io',
    '"program manager" site:boards.greenhouse.io',
    '"scrum master" site:boards.greenhouse.io',
    '"delivery manager" site:boards.greenhouse.io',
  ],

  // Content & Creative (3 categories)
  writing: [
    '"content writer" site:boards.greenhouse.io',
    '"copywriter" site:boards.greenhouse.io',
    '"technical writer" site:boards.greenhouse.io',
    '"content strategist" site:boards.greenhouse.io',
    '"editor" site:boards.greenhouse.io',
  ],
  translation: [
    '"translator" site:boards.greenhouse.io',
    '"localization" site:boards.greenhouse.io',
    '"interpreter" site:boards.greenhouse.io',
    '"localization manager" site:boards.greenhouse.io',
    '"language specialist" site:boards.greenhouse.io',
  ],
  creative: [
    '"video editor" site:boards.greenhouse.io',
    '"motion designer" site:boards.greenhouse.io',
    '"animator" site:boards.greenhouse.io',
    '"creative director" site:boards.greenhouse.io',
    '"multimedia" site:boards.greenhouse.io',
  ],

  // Other (4 categories)
  support: [
    '"customer support" site:boards.greenhouse.io',
    '"customer service" site:boards.greenhouse.io',
    '"support engineer" site:boards.greenhouse.io',
    '"technical support" site:boards.greenhouse.io',
  ],
  education: [
    '"instructional designer" site:boards.greenhouse.io',
    '"training specialist" site:boards.greenhouse.io',
    '"learning" site:boards.greenhouse.io',
    '"curriculum" site:boards.greenhouse.io',
  ],
  research: [
    '"researcher" site:boards.greenhouse.io',
    '"ux researcher" site:boards.greenhouse.io',
    '"user researcher" site:boards.greenhouse.io',
    '"research scientist" site:boards.greenhouse.io',
  ],
  consulting: [
    '"consultant" site:boards.greenhouse.io',
    '"solutions architect" site:boards.greenhouse.io',
    '"implementation" site:boards.greenhouse.io',
    '"professional services" site:boards.greenhouse.io',
  ],
};

// Flat list of all queries
export const GREENHOUSE_SEARCH_QUERIES = Object.values(GREENHOUSE_QUERIES_BY_CATEGORY).flat();

// Get queries for specific category
export function getQueriesForCategory(category: string): string[] {
  return GREENHOUSE_QUERIES_BY_CATEGORY[category] || [];
}

// Get all queries as newline-separated string (for Apify input)
export function getAllQueriesAsString(): string {
  return GREENHOUSE_SEARCH_QUERIES.join('\n');
}

/**
 * Extract company slug from Greenhouse job URL
 * Examples:
 *   https://boards.greenhouse.io/stripe/jobs/123 → "stripe"
 *   https://boards.greenhouse.io/airbnb → "airbnb"
 *   https://job-boards.greenhouse.io/notion/jobs/456 → "notion"
 */
export function extractGreenhouseSlug(url: string): string | null {
  try {
    const parsed = new URL(url);

    // Must be greenhouse.io
    if (!parsed.hostname.includes('greenhouse.io')) {
      return null;
    }

    // Path format: /{company-slug}/jobs/{job-id} or /{company-slug}
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 1) {
      const slug = pathParts[0].toLowerCase();

      // Skip generic/invalid slugs
      if (slug.length < 2 || slug === 'jobs' || slug === 'embed') {
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
    const slug = extractGreenhouseSlug(url);
    if (slug) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs).sort();
}
