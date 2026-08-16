/**
 * SmartRecruiters Company Discovery Configuration
 *
 * Search queries for finding new companies on SmartRecruiters via Google Search.
 * Organized by 21 job categories matching site.ts categories.
 *
 * Run weekly via Apify → /api/cron/discover-smartrecruiters
 */

// Search queries organized by category (21 categories)
export const SMARTRECRUITERS_QUERIES_BY_CATEGORY: Record<string, string[]> = {
  // Tech (6 categories)
  engineering: [
    '"software engineer" site:jobs.smartrecruiters.com',
    '"developer" site:jobs.smartrecruiters.com',
    '"frontend engineer" site:jobs.smartrecruiters.com',
    '"backend engineer" site:jobs.smartrecruiters.com',
    '"fullstack" site:jobs.smartrecruiters.com',
    '"mobile engineer" site:jobs.smartrecruiters.com',
  ],
  design: [
    '"product designer" site:jobs.smartrecruiters.com',
    '"ux designer" site:jobs.smartrecruiters.com',
    '"ui designer" site:jobs.smartrecruiters.com',
    '"visual designer" site:jobs.smartrecruiters.com',
    '"design lead" site:jobs.smartrecruiters.com',
  ],
  data: [
    '"data scientist" site:jobs.smartrecruiters.com',
    '"data engineer" site:jobs.smartrecruiters.com',
    '"data analyst" site:jobs.smartrecruiters.com',
    '"machine learning" site:jobs.smartrecruiters.com',
    '"ai engineer" site:jobs.smartrecruiters.com',
  ],
  devops: [
    '"devops engineer" site:jobs.smartrecruiters.com',
    '"sre" site:jobs.smartrecruiters.com',
    '"platform engineer" site:jobs.smartrecruiters.com',
    '"cloud engineer" site:jobs.smartrecruiters.com',
    '"infrastructure engineer" site:jobs.smartrecruiters.com',
  ],
  qa: [
    '"qa engineer" site:jobs.smartrecruiters.com',
    '"test engineer" site:jobs.smartrecruiters.com',
    '"quality assurance" site:jobs.smartrecruiters.com',
    '"automation engineer" site:jobs.smartrecruiters.com',
  ],
  security: [
    '"security engineer" site:jobs.smartrecruiters.com',
    '"cybersecurity" site:jobs.smartrecruiters.com',
    '"information security" site:jobs.smartrecruiters.com',
    '"security analyst" site:jobs.smartrecruiters.com',
  ],

  // Business (8 categories)
  product: [
    '"product manager" site:jobs.smartrecruiters.com',
    '"product owner" site:jobs.smartrecruiters.com',
    '"product lead" site:jobs.smartrecruiters.com',
    '"head of product" site:jobs.smartrecruiters.com',
  ],
  marketing: [
    '"marketing manager" site:jobs.smartrecruiters.com',
    '"growth marketing" site:jobs.smartrecruiters.com',
    '"content marketing" site:jobs.smartrecruiters.com',
    '"performance marketing" site:jobs.smartrecruiters.com',
    '"demand generation" site:jobs.smartrecruiters.com',
  ],
  sales: [
    '"account executive" site:jobs.smartrecruiters.com',
    '"sales engineer" site:jobs.smartrecruiters.com',
    '"sales representative" site:jobs.smartrecruiters.com',
    '"business development" site:jobs.smartrecruiters.com',
    '"customer success" site:jobs.smartrecruiters.com',
  ],
  finance: [
    '"financial analyst" site:jobs.smartrecruiters.com',
    '"accountant" site:jobs.smartrecruiters.com',
    '"controller" site:jobs.smartrecruiters.com',
    '"finance manager" site:jobs.smartrecruiters.com',
    '"fp&a" site:jobs.smartrecruiters.com',
  ],
  hr: [
    '"recruiter" site:jobs.smartrecruiters.com',
    '"talent acquisition" site:jobs.smartrecruiters.com',
    '"hr manager" site:jobs.smartrecruiters.com',
    '"people operations" site:jobs.smartrecruiters.com',
    '"hr business partner" site:jobs.smartrecruiters.com',
  ],
  operations: [
    '"operations manager" site:jobs.smartrecruiters.com',
    '"operations analyst" site:jobs.smartrecruiters.com',
    '"business operations" site:jobs.smartrecruiters.com',
    '"revenue operations" site:jobs.smartrecruiters.com',
  ],
  legal: [
    '"legal counsel" site:jobs.smartrecruiters.com',
    '"attorney" site:jobs.smartrecruiters.com',
    '"paralegal" site:jobs.smartrecruiters.com',
    '"contracts manager" site:jobs.smartrecruiters.com',
    '"compliance" site:jobs.smartrecruiters.com',
  ],
  'project-management': [
    '"project manager" site:jobs.smartrecruiters.com',
    '"program manager" site:jobs.smartrecruiters.com',
    '"scrum master" site:jobs.smartrecruiters.com',
    '"delivery manager" site:jobs.smartrecruiters.com',
  ],

  // Content & Creative (3 categories)
  writing: [
    '"content writer" site:jobs.smartrecruiters.com',
    '"copywriter" site:jobs.smartrecruiters.com',
    '"technical writer" site:jobs.smartrecruiters.com',
    '"content strategist" site:jobs.smartrecruiters.com',
    '"editor" site:jobs.smartrecruiters.com',
  ],
  translation: [
    '"translator" site:jobs.smartrecruiters.com',
    '"localization" site:jobs.smartrecruiters.com',
    '"interpreter" site:jobs.smartrecruiters.com',
    '"localization manager" site:jobs.smartrecruiters.com',
    '"language specialist" site:jobs.smartrecruiters.com',
  ],
  creative: [
    '"video editor" site:jobs.smartrecruiters.com',
    '"motion designer" site:jobs.smartrecruiters.com',
    '"animator" site:jobs.smartrecruiters.com',
    '"creative director" site:jobs.smartrecruiters.com',
    '"multimedia" site:jobs.smartrecruiters.com',
  ],

  // Other (4 categories)
  support: [
    '"customer support" site:jobs.smartrecruiters.com',
    '"customer service" site:jobs.smartrecruiters.com',
    '"support engineer" site:jobs.smartrecruiters.com',
    '"technical support" site:jobs.smartrecruiters.com',
  ],
  education: [
    '"instructional designer" site:jobs.smartrecruiters.com',
    '"training specialist" site:jobs.smartrecruiters.com',
    '"learning" site:jobs.smartrecruiters.com',
    '"curriculum" site:jobs.smartrecruiters.com',
  ],
  research: [
    '"researcher" site:jobs.smartrecruiters.com',
    '"ux researcher" site:jobs.smartrecruiters.com',
    '"user researcher" site:jobs.smartrecruiters.com',
    '"research scientist" site:jobs.smartrecruiters.com',
  ],
  consulting: [
    '"consultant" site:jobs.smartrecruiters.com',
    '"solutions architect" site:jobs.smartrecruiters.com',
    '"implementation" site:jobs.smartrecruiters.com',
    '"professional services" site:jobs.smartrecruiters.com',
  ],
};

// Flat list of all queries
export const SMARTRECRUITERS_SEARCH_QUERIES = Object.values(SMARTRECRUITERS_QUERIES_BY_CATEGORY).flat();

/**
 * Extract company slug from SmartRecruiters job URL
 * Examples:
 *   https://jobs.smartrecruiters.com/Datadog/12345 → "Datadog"
 *   https://jobs.smartrecruiters.com/Visa/743999 → "Visa"
 */
export function extractSmartRecruitersSlug(url: string): string | null {
  try {
    const parsed = new URL(url);

    if (!parsed.hostname.includes('smartrecruiters.com')) {
      return null;
    }

    const pathParts = parsed.pathname.split('/').filter(Boolean);

    if (pathParts.length >= 1) {
      const slug = pathParts[0];

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
    const slug = extractSmartRecruitersSlug(url);
    if (slug) {
      slugs.add(slug);
    }
  }

  return Array.from(slugs).sort();
}
