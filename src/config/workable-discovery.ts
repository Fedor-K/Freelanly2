/**
 * Workable Company Discovery Configuration
 *
 * Search queries for finding new companies on Workable via Google Search.
 * Organized by 21 job categories matching site.ts categories.
 *
 * Run weekly via Apify → /api/cron/discover-workable
 */

// Search queries organized by category (21 categories)
export const WORKABLE_QUERIES_BY_CATEGORY: Record<string, string[]> = {
  // Tech (6 categories)
  engineering: [
    '"software engineer" site:apply.workable.com',
    '"developer" site:apply.workable.com',
    '"frontend engineer" site:apply.workable.com',
    '"backend engineer" site:apply.workable.com',
    '"fullstack" site:apply.workable.com',
    '"mobile engineer" site:apply.workable.com',
  ],
  design: [
    '"product designer" site:apply.workable.com',
    '"ux designer" site:apply.workable.com',
    '"ui designer" site:apply.workable.com',
    '"visual designer" site:apply.workable.com',
    '"design lead" site:apply.workable.com',
  ],
  data: [
    '"data scientist" site:apply.workable.com',
    '"data engineer" site:apply.workable.com',
    '"data analyst" site:apply.workable.com',
    '"machine learning" site:apply.workable.com',
    '"ai engineer" site:apply.workable.com',
  ],
  devops: [
    '"devops engineer" site:apply.workable.com',
    '"sre" site:apply.workable.com',
    '"platform engineer" site:apply.workable.com',
    '"cloud engineer" site:apply.workable.com',
    '"infrastructure engineer" site:apply.workable.com',
  ],
  qa: [
    '"qa engineer" site:apply.workable.com',
    '"test engineer" site:apply.workable.com',
    '"quality assurance" site:apply.workable.com',
    '"automation engineer" site:apply.workable.com',
  ],
  security: [
    '"security engineer" site:apply.workable.com',
    '"cybersecurity" site:apply.workable.com',
    '"information security" site:apply.workable.com',
    '"security analyst" site:apply.workable.com',
  ],

  // Business (8 categories)
  product: [
    '"product manager" site:apply.workable.com',
    '"product owner" site:apply.workable.com',
    '"product lead" site:apply.workable.com',
    '"head of product" site:apply.workable.com',
  ],
  marketing: [
    '"marketing manager" site:apply.workable.com',
    '"growth marketing" site:apply.workable.com',
    '"content marketing" site:apply.workable.com',
    '"performance marketing" site:apply.workable.com',
    '"demand generation" site:apply.workable.com',
  ],
  sales: [
    '"account executive" site:apply.workable.com',
    '"sales engineer" site:apply.workable.com',
    '"sales representative" site:apply.workable.com',
    '"business development" site:apply.workable.com',
    '"customer success" site:apply.workable.com',
  ],
  finance: [
    '"financial analyst" site:apply.workable.com',
    '"accountant" site:apply.workable.com',
    '"controller" site:apply.workable.com',
    '"finance manager" site:apply.workable.com',
    '"fp&a" site:apply.workable.com',
  ],
  hr: [
    '"recruiter" site:apply.workable.com',
    '"talent acquisition" site:apply.workable.com',
    '"hr manager" site:apply.workable.com',
    '"people operations" site:apply.workable.com',
    '"hr business partner" site:apply.workable.com',
  ],
  operations: [
    '"operations manager" site:apply.workable.com',
    '"operations analyst" site:apply.workable.com',
    '"business operations" site:apply.workable.com',
    '"revenue operations" site:apply.workable.com',
  ],
  legal: [
    '"legal counsel" site:apply.workable.com',
    '"attorney" site:apply.workable.com',
    '"paralegal" site:apply.workable.com',
    '"contracts manager" site:apply.workable.com',
    '"compliance" site:apply.workable.com',
  ],
  'project-management': [
    '"project manager" site:apply.workable.com',
    '"program manager" site:apply.workable.com',
    '"scrum master" site:apply.workable.com',
    '"delivery manager" site:apply.workable.com',
  ],

  // Content & Creative (3 categories)
  writing: [
    '"content writer" site:apply.workable.com',
    '"copywriter" site:apply.workable.com',
    '"technical writer" site:apply.workable.com',
    '"content strategist" site:apply.workable.com',
    '"editor" site:apply.workable.com',
  ],
  translation: [
    '"translator" site:apply.workable.com',
    '"localization" site:apply.workable.com',
    '"interpreter" site:apply.workable.com',
    '"localization manager" site:apply.workable.com',
    '"language specialist" site:apply.workable.com',
  ],
  creative: [
    '"video editor" site:apply.workable.com',
    '"motion designer" site:apply.workable.com',
    '"animator" site:apply.workable.com',
    '"creative director" site:apply.workable.com',
    '"multimedia" site:apply.workable.com',
  ],

  // Other (4 categories)
  support: [
    '"customer support" site:apply.workable.com',
    '"customer service" site:apply.workable.com',
    '"support engineer" site:apply.workable.com',
    '"technical support" site:apply.workable.com',
  ],
  education: [
    '"instructional designer" site:apply.workable.com',
    '"training specialist" site:apply.workable.com',
    '"learning" site:apply.workable.com',
    '"curriculum" site:apply.workable.com',
  ],
  research: [
    '"researcher" site:apply.workable.com',
    '"ux researcher" site:apply.workable.com',
    '"user researcher" site:apply.workable.com',
    '"research scientist" site:apply.workable.com',
  ],
  consulting: [
    '"consultant" site:apply.workable.com',
    '"solutions architect" site:apply.workable.com',
    '"implementation" site:apply.workable.com',
    '"professional services" site:apply.workable.com',
  ],
};

// Flat list of all queries
export const WORKABLE_SEARCH_QUERIES = Object.values(WORKABLE_QUERIES_BY_CATEGORY).flat();

/**
 * Extract company slug from Workable job URL
 * Examples:
 *   https://apply.workable.com/foodics/j/ABC123 → "foodics"
 *   https://apply.workable.com/toggl/ → "toggl"
 */
export function extractWorkableSlug(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (!parsed.hostname.includes('workable.com')) {
      return null;
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 1) {
      const slug = pathParts[0].toLowerCase();

      if (slug.length < 2 || slug === 'jobs' || slug === 'apply' || slug === 'api') {
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
    const slug = extractWorkableSlug(url);
    if (slug) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs).sort();
}
