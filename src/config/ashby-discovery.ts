/**
 * Ashby Company Discovery Configuration
 *
 * Search queries for finding new companies on Ashby via Google Search.
 * Organized by 21 job categories matching site.ts categories.
 *
 * Run weekly via Apify → /api/cron/discover-ashby
 */

// Search queries organized by category (21 categories)
export const ASHBY_QUERIES_BY_CATEGORY: Record<string, string[]> = {
  // Tech (6 categories)
  engineering: [
    '"software engineer" site:jobs.ashbyhq.com',
    '"developer" site:jobs.ashbyhq.com',
    '"frontend engineer" site:jobs.ashbyhq.com',
    '"backend engineer" site:jobs.ashbyhq.com',
    '"fullstack" site:jobs.ashbyhq.com',
    '"mobile engineer" site:jobs.ashbyhq.com',
  ],
  design: [
    '"product designer" site:jobs.ashbyhq.com',
    '"ux designer" site:jobs.ashbyhq.com',
    '"ui designer" site:jobs.ashbyhq.com',
    '"visual designer" site:jobs.ashbyhq.com',
    '"design lead" site:jobs.ashbyhq.com',
  ],
  data: [
    '"data scientist" site:jobs.ashbyhq.com',
    '"data engineer" site:jobs.ashbyhq.com',
    '"data analyst" site:jobs.ashbyhq.com',
    '"machine learning" site:jobs.ashbyhq.com',
    '"ai engineer" site:jobs.ashbyhq.com',
  ],
  devops: [
    '"devops engineer" site:jobs.ashbyhq.com',
    '"sre" site:jobs.ashbyhq.com',
    '"platform engineer" site:jobs.ashbyhq.com',
    '"cloud engineer" site:jobs.ashbyhq.com',
    '"infrastructure engineer" site:jobs.ashbyhq.com',
  ],
  qa: [
    '"qa engineer" site:jobs.ashbyhq.com',
    '"test engineer" site:jobs.ashbyhq.com',
    '"quality assurance" site:jobs.ashbyhq.com',
    '"automation engineer" site:jobs.ashbyhq.com',
  ],
  security: [
    '"security engineer" site:jobs.ashbyhq.com',
    '"cybersecurity" site:jobs.ashbyhq.com',
    '"information security" site:jobs.ashbyhq.com',
    '"security analyst" site:jobs.ashbyhq.com',
  ],

  // Business (8 categories)
  product: [
    '"product manager" site:jobs.ashbyhq.com',
    '"product owner" site:jobs.ashbyhq.com',
    '"product lead" site:jobs.ashbyhq.com',
    '"head of product" site:jobs.ashbyhq.com',
  ],
  marketing: [
    '"marketing manager" site:jobs.ashbyhq.com',
    '"growth marketing" site:jobs.ashbyhq.com',
    '"content marketing" site:jobs.ashbyhq.com',
    '"performance marketing" site:jobs.ashbyhq.com',
    '"demand generation" site:jobs.ashbyhq.com',
  ],
  sales: [
    '"account executive" site:jobs.ashbyhq.com',
    '"sales engineer" site:jobs.ashbyhq.com',
    '"sales representative" site:jobs.ashbyhq.com',
    '"business development" site:jobs.ashbyhq.com',
    '"customer success" site:jobs.ashbyhq.com',
  ],
  finance: [
    '"financial analyst" site:jobs.ashbyhq.com',
    '"accountant" site:jobs.ashbyhq.com',
    '"controller" site:jobs.ashbyhq.com',
    '"finance manager" site:jobs.ashbyhq.com',
    '"fp&a" site:jobs.ashbyhq.com',
  ],
  hr: [
    '"recruiter" site:jobs.ashbyhq.com',
    '"talent acquisition" site:jobs.ashbyhq.com',
    '"hr manager" site:jobs.ashbyhq.com',
    '"people operations" site:jobs.ashbyhq.com',
    '"hr business partner" site:jobs.ashbyhq.com',
  ],
  operations: [
    '"operations manager" site:jobs.ashbyhq.com',
    '"operations analyst" site:jobs.ashbyhq.com',
    '"business operations" site:jobs.ashbyhq.com',
    '"revenue operations" site:jobs.ashbyhq.com',
  ],
  legal: [
    '"legal counsel" site:jobs.ashbyhq.com',
    '"attorney" site:jobs.ashbyhq.com',
    '"paralegal" site:jobs.ashbyhq.com',
    '"contracts manager" site:jobs.ashbyhq.com',
    '"compliance" site:jobs.ashbyhq.com',
  ],
  'project-management': [
    '"project manager" site:jobs.ashbyhq.com',
    '"program manager" site:jobs.ashbyhq.com',
    '"scrum master" site:jobs.ashbyhq.com',
    '"delivery manager" site:jobs.ashbyhq.com',
  ],

  // Content & Creative (3 categories)
  writing: [
    '"content writer" site:jobs.ashbyhq.com',
    '"copywriter" site:jobs.ashbyhq.com',
    '"technical writer" site:jobs.ashbyhq.com',
    '"content strategist" site:jobs.ashbyhq.com',
    '"editor" site:jobs.ashbyhq.com',
  ],
  translation: [
    '"translator" site:jobs.ashbyhq.com',
    '"localization" site:jobs.ashbyhq.com',
    '"interpreter" site:jobs.ashbyhq.com',
    '"localization manager" site:jobs.ashbyhq.com',
    '"language specialist" site:jobs.ashbyhq.com',
  ],
  creative: [
    '"video editor" site:jobs.ashbyhq.com',
    '"motion designer" site:jobs.ashbyhq.com',
    '"animator" site:jobs.ashbyhq.com',
    '"creative director" site:jobs.ashbyhq.com',
    '"multimedia" site:jobs.ashbyhq.com',
  ],

  // Other (4 categories)
  support: [
    '"customer support" site:jobs.ashbyhq.com',
    '"customer service" site:jobs.ashbyhq.com',
    '"support engineer" site:jobs.ashbyhq.com',
    '"technical support" site:jobs.ashbyhq.com',
  ],
  education: [
    '"instructional designer" site:jobs.ashbyhq.com',
    '"training specialist" site:jobs.ashbyhq.com',
    '"learning" site:jobs.ashbyhq.com',
    '"curriculum" site:jobs.ashbyhq.com',
  ],
  research: [
    '"researcher" site:jobs.ashbyhq.com',
    '"ux researcher" site:jobs.ashbyhq.com',
    '"user researcher" site:jobs.ashbyhq.com',
    '"research scientist" site:jobs.ashbyhq.com',
  ],
  consulting: [
    '"consultant" site:jobs.ashbyhq.com',
    '"solutions architect" site:jobs.ashbyhq.com',
    '"implementation" site:jobs.ashbyhq.com',
    '"professional services" site:jobs.ashbyhq.com',
  ],
};

// Flat list of all queries
export const ASHBY_SEARCH_QUERIES = Object.values(ASHBY_QUERIES_BY_CATEGORY).flat();

/**
 * Extract company slug from Ashby job URL
 * Examples:
 *   https://jobs.ashbyhq.com/ramp/abc123 → "ramp"
 *   https://jobs.ashbyhq.com/figma → "figma"
 */
export function extractAshbySlug(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (!parsed.hostname.includes('ashbyhq.com')) {
      return null;
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 1) {
      const slug = pathParts[0].toLowerCase();

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
    const slug = extractAshbySlug(url);
    if (slug) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs).sort();
}
