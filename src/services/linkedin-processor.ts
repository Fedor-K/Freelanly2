import { prisma } from '@/lib/db';
import {
  scrapeLinkedInPosts,
  getPostsFromDataset,
  getPostsFromRun,
  HIRING_SEARCH_QUERIES,
  type LinkedInPost,
  type ScrapeOptions,
} from '@/lib/apify';
import { getApifySettings } from '@/lib/settings';
import { extractJobData, classifyJobCategory, type ExtractedJobData } from '@/lib/deepseek';
import { slugify, isFreeEmail, cleanEmail, extractDomainFromEmail } from '@/lib/utils';
import { validateAndEnrichCompany } from '@/services/company-enrichment';
import { cleanupOldJobs } from '@/services/job-cleanup';
import { buildJobUrl, notifySearchEngines } from '@/lib/indexing';
import { sendInstantAlertsForJob } from '@/services/alert-notifications';
import { addToSocialQueue } from '@/services/social-post';

// Re-export for cron endpoint
export { HIRING_SEARCH_QUERIES };

interface ProcessedJob {
  success: boolean;
  jobId?: string;
  companySlug?: string;
  jobSlug?: string;
  error?: string;
}

interface ProcessingStats {
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
  createdJobUrls: string[];
}

// Fetch and process LinkedIn hiring posts (triggers new Apify run)
// Uses settings from DB, options are optional overrides
export async function fetchAndProcessLinkedInPosts(options?: {
  keywords?: string[];
  maxPosts?: number;
  postedLimit?: '24h' | 'week' | 'month';
}): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    createdJobUrls: [],
  };

  // Create import log
  const importLog = await prisma.importLog.create({
    data: {
      source: 'LINKEDIN',
      status: 'RUNNING',
    },
  });

  try {
    // 1. Scrape LinkedIn posts via Apify (uses settings from DB)
    console.log('Fetching LinkedIn posts via Apify...');

    // Pass overrides if provided, otherwise scrapeLinkedInPosts uses DB settings
    const scrapeOptions: Partial<ScrapeOptions> = {};
    if (options?.keywords) scrapeOptions.searchQueries = options.keywords;
    if (options?.maxPosts) scrapeOptions.maxPosts = options.maxPosts;
    if (options?.postedLimit) scrapeOptions.postedLimit = options.postedLimit;

    const posts = await scrapeLinkedInPosts(Object.keys(scrapeOptions).length > 0 ? scrapeOptions : undefined);
    stats.total = posts.length;
    console.log(`Fetched ${posts.length} posts`);

    // 2. Process posts
    await processPostsBatch(posts, stats);

    // Update import log
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'COMPLETED',
        totalFetched: stats.total,
        totalNew: stats.created,
        totalSkipped: stats.skipped,
        totalFailed: stats.failed,
        errors: stats.errors.length > 0 ? stats.errors : undefined,
        completedAt: new Date(),
      },
    });

    // Notify search engines about new jobs (IndexNow)
    if (stats.createdJobUrls.length > 0) {
      try {
        await notifySearchEngines(stats.createdJobUrls);
      } catch (indexError) {
        console.error('[LinkedIn] Search engine notification failed:', indexError);
      }
    }

    // Cleanup old jobs after successful import
    await cleanupOldJobs();

    return stats;
  } catch (error) {
    // Update import log with error
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'FAILED',
        errors: [String(error)],
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

// Process posts from existing Apify dataset (for webhook)
export async function processPostsFromDataset(datasetId: string): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    createdJobUrls: [],
  };

  const importLog = await prisma.importLog.create({
    data: {
      source: 'LINKEDIN',
      status: 'RUNNING',
    },
  });

  try {
    console.log(`Fetching posts from Apify dataset: ${datasetId}`);
    const posts = await getPostsFromDataset(datasetId);
    stats.total = posts.length;
    console.log(`Fetched ${posts.length} posts from dataset`);

    await processPostsBatch(posts, stats);

    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'COMPLETED',
        totalFetched: stats.total,
        totalNew: stats.created,
        totalSkipped: stats.skipped,
        totalFailed: stats.failed,
        errors: stats.errors.length > 0 ? stats.errors : undefined,
        completedAt: new Date(),
      },
    });

    // Notify search engines about new jobs (IndexNow)
    if (stats.createdJobUrls.length > 0) {
      try {
        await notifySearchEngines(stats.createdJobUrls);
      } catch (indexError) {
        console.error('[LinkedIn] Search engine notification failed:', indexError);
      }
    }

    // Cleanup old jobs after successful import
    await cleanupOldJobs();

    return stats;
  } catch (error) {
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'FAILED',
        errors: [String(error)],
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

// Process posts from Apify run ID
export async function processPostsFromRun(runId: string): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    total: 0,
    processed: 0,
    created: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    createdJobUrls: [],
  };

  const importLog = await prisma.importLog.create({
    data: {
      source: 'LINKEDIN',
      status: 'RUNNING',
    },
  });

  try {
    console.log(`Fetching posts from Apify run: ${runId}`);
    const posts = await getPostsFromRun(runId);
    stats.total = posts.length;
    console.log(`Fetched ${posts.length} posts from run`);

    await processPostsBatch(posts, stats);

    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'COMPLETED',
        totalFetched: stats.total,
        totalNew: stats.created,
        totalSkipped: stats.skipped,
        totalFailed: stats.failed,
        errors: stats.errors.length > 0 ? stats.errors : undefined,
        completedAt: new Date(),
      },
    });

    // Notify search engines about new jobs (IndexNow)
    if (stats.createdJobUrls.length > 0) {
      try {
        await notifySearchEngines(stats.createdJobUrls);
      } catch (indexError) {
        console.error('[LinkedIn] Search engine notification failed:', indexError);
      }
    }

    // Cleanup old jobs after successful import
    await cleanupOldJobs();

    return stats;
  } catch (error) {
    await prisma.importLog.update({
      where: { id: importLog.id },
      data: {
        status: 'FAILED',
        errors: [String(error)],
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

// Process a batch of posts
async function processPostsBatch(posts: LinkedInPost[], stats: ProcessingStats): Promise<void> {
  for (const post of posts) {
    try {
      const result = await processLinkedInPost(post);
      stats.processed++;

      if (result.success && result.jobId) {
        stats.created++;
        if (result.companySlug && result.jobSlug) {
          stats.createdJobUrls.push(buildJobUrl(result.companySlug, result.jobSlug));
        }
      } else if (result.error === 'duplicate') {
        stats.skipped++;
      } else {
        stats.failed++;
        if (result.error) {
          stats.errors.push(result.error);
        }
      }

      // Rate limiting - small delay between posts
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error) {
      stats.failed++;
      stats.errors.push(String(error));
    }
  }
}

// Process a single LinkedIn post
async function processLinkedInPost(post: LinkedInPost): Promise<ProcessedJob> {
  // Check if already exists
  const existingJob = await prisma.job.findFirst({
    where: {
      OR: [
        { sourceId: post.id },
        { sourceUrl: post.url },
      ],
    },
  });

  if (existingJob) {
    return { success: false, error: 'duplicate' };
  }

  // Extract job data using DeepSeek
  console.log(`Extracting data from post: ${post.content.slice(0, 50)}...`);
  const extracted = await extractJobData(post.content);

  if (!extracted || !extracted.title) {
    return { success: false, error: 'Could not extract job title' };
  }

  // Clean and validate email (handles AI-extracted emails with extra text)
  const validatedEmail = cleanEmail(extracted.contactEmail);

  // Skip jobs without corporate email (filter out gmail, yahoo, etc.)
  if (!validatedEmail || isFreeEmail(validatedEmail)) {
    return { success: false, error: 'No corporate email - skipped' };
  }

  // Get company name - EMAIL DOMAIN IS SOURCE OF TRUTH (who is actually hiring)
  // Priority: email domain → DeepSeek extraction → headline → author name
  const emailCompany = extractCompanyFromEmail(validatedEmail);
  const extractedCompany = isGenericCompanyName(extracted.company) ? null : extracted.company;

  const companyName = emailCompany ||
    extractedCompany ||
    extractCompanyFromHeadline(post.authorHeadline) ||
    post.authorName;

  // Find or create company (with email for website fallback)
  const company = await findOrCreateCompany({
    name: companyName,
    linkedinUrl: post.authorLinkedInUrl,
    email: validatedEmail,
  });

  // Validate company via Apollo and check for logo
  // This filters out fake recruiters with custom domains
  const isValidCompany = await validateAndEnrichCompany(company.id, validatedEmail);

  if (!isValidCompany) {
    // Delete the company we just created (it's fake)
    await prisma.company.delete({ where: { id: company.id } }).catch(() => {
      // Ignore if company has other jobs
    });
    return { success: false, error: 'Company validation failed - Apollo unknown or no logo' };
  }

  // Check for duplicate job by title + company within last 10 days
  // (allows same job title to be posted again after 10 days as a new vacancy)
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const duplicateByTitle = await prisma.job.findFirst({
    where: {
      companyId: company.id,
      title: { equals: extracted.title, mode: 'insensitive' },
      createdAt: { gte: tenDaysAgo },
    },
  });

  if (duplicateByTitle) {
    return { success: false, error: 'duplicate' };
  }

  // Classify category
  const categorySlug = await classifyJobCategory(extracted.title, extracted.skills);
  let category = await prisma.category.findUnique({ where: { slug: categorySlug } });

  // Create category if it doesn't exist
  if (!category) {
    category = await prisma.category.create({
      data: {
        slug: categorySlug,
        name: getCategoryName(categorySlug),
      },
    });
  }

  // Generate unique slug
  const baseSlug = slugify(`${extracted.title}-${company.name}`);
  const slug = await generateUniqueSlug(baseSlug);

  // Map location type
  const locationType = mapLocationType(extracted.isRemote, extracted.location);

  // Filter: only REMOTE and HYBRID jobs (skip ONSITE)
  if (locationType === 'ONSITE') {
    return { success: false, error: 'ONSITE job - skipped' };
  }

  // Create job (with unique constraint handling for race conditions)
  let job;
  try {
    job = await prisma.job.create({
      data: {
        slug,
        title: extracted.title,
        description: post.content, // Original post as description
        companyId: company.id,
        categoryId: category.id,
        location: extracted.isRemote ? (extracted.location || 'Remote') : extracted.location,
        locationType,
        country: extractCountryCode(extracted.location),
        level: extracted.level || 'MID',
        type: extracted.type || 'FULL_TIME',
        salaryMin: extracted.salaryMin,
        salaryMax: extracted.salaryMax,
        salaryCurrency: extracted.salaryCurrency || 'USD',
        salaryPeriod: extracted.salaryPeriod || 'YEAR',
        salaryIsEstimate: !extracted.salaryMin,
        skills: extracted.skills,
        benefits: extracted.benefits,
        translationTypes: extracted.translationTypes || [],
        sourceLanguages: extracted.sourceLanguages || [],
        targetLanguages: extracted.targetLanguages || [],
        cleanDescription: extracted.cleanDescription,
        summaryBullets: extracted.summaryBullets || [],
        requirementBullets: extracted.requirementBullets || [],
        benefitBullets: extracted.benefitBullets || [],
        source: 'LINKEDIN',
        sourceType: 'UNSTRUCTURED',
        sourceUrl: post.url,
        sourceId: post.id,
        originalContent: post.content,
        authorLinkedIn: post.authorLinkedInUrl,
        authorName: post.authorName,
        applyEmail: validatedEmail,
        applyUrl: extracted.applyUrl,
        enrichmentStatus: 'COMPLETED',
        qualityScore: calculateQualityScore(extracted, post),
        postedAt: post.postedAt,
      },
    });
  } catch (createError: unknown) {
    // Handle unique constraint violation (race condition - job already exists)
    if (
      createError &&
      typeof createError === 'object' &&
      'code' in createError &&
      createError.code === 'P2002'
    ) {
      console.log(`[LinkedIn] Duplicate job (unique constraint), skipping: ${extracted.title}`);
      return { success: false, error: 'duplicate' };
    }
    throw createError;
  }

  // Note: Company enrichment is already done in validateAndEnrichCompany()

  // Send INSTANT alerts for this job (non-blocking)
  sendInstantAlertsForJob(job.id).catch((err) => {
    console.error('[LinkedIn] Instant alerts failed:', err);
  });

  // Add to social post queue (non-blocking)
  addToSocialQueue(job.id).catch((err) => {
    console.error('[LinkedIn] Social queue failed:', err);
  });

  return { success: true, jobId: job.id, companySlug: company.slug, jobSlug: slug };
}

// Extract company from headline like "Title at Company | More info"
function extractCompanyFromHeadline(headline: string | null): string | null {
  if (!headline) return null;

  const patterns = [
    /(?:at|@)\s+([^|,]+)/i,
    /\|\s*([^|]+)$/,
  ];

  for (const pattern of patterns) {
    const match = headline.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}

// Extract company name from email domain (e.g., "vidhipatel@earlyjobs.co.in" → "EarlyJobs")
function extractCompanyFromEmail(email: string | null): string | null {
  if (!email) return null;

  const match = email.match(/@([^.]+)\./);
  if (!match || !match[1]) return null;

  const domain = match[1];

  // Skip if domain looks like a person's name (contains common name patterns)
  if (domain.length < 3) return null;

  // Convert to title case and handle common patterns
  // "earlyjobs" → "EarlyJobs", "company" → "Company"
  const formatted = domain
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → separate words
    .replace(/[-_]/g, ' ') // hyphens/underscores → spaces
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');

  return formatted;
}

// Check if company name is generic (not a real company name)
// These are commonly extracted by AI from generic job post phrases
const GENERIC_COMPANY_PATTERNS = [
  /^freelance/i,
  /^remote/i,
  /recruitment$/i,
  /hiring$/i,
  /staffing/i,
  /agency$/i,
  /talent acquisition/i,
  /^hr\s/i,
  /^human resources/i,
  /job board/i,
  /career/i,
  /employment/i,
  /^we are hiring/i,
  /^now hiring/i,
];

function isGenericCompanyName(name: string | null | undefined): boolean {
  if (!name) return true;
  const normalized = name.trim().toLowerCase();
  if (normalized.length < 2) return true;

  return GENERIC_COMPANY_PATTERNS.some(pattern => pattern.test(name));
}

// Get category display name
function getCategoryName(slug: string): string {
  const names: Record<string, string> = {
    engineering: 'Engineering',
    frontend: 'Frontend',
    backend: 'Backend',
    fullstack: 'Full Stack',
    mobile: 'Mobile',
    devops: 'DevOps',
    data: 'Data',
    design: 'Design',
    product: 'Product',
    marketing: 'Marketing',
    sales: 'Sales',
    support: 'Support',
    hr: 'HR',
    finance: 'Finance',
  };
  return names[slug] || slug;
}

// Normalize company name for matching (remove extra spaces, common suffixes variations)
function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/,\s*$/, '') // Trailing comma
    .replace(/\s*[-–—]\s*Engineering.*$/i, '') // Remove "- Engineering..." suffix
    .replace(/\s*[-–—]\s*Technology.*$/i, '') // Remove "- Technology..." suffix
    .trim();
}

// Find or create company
async function findOrCreateCompany(data: {
  name: string;
  linkedinUrl?: string | null;
  email?: string | null;
}) {
  const normalizedName = normalizeCompanyName(data.name);
  const slug = slugify(normalizedName);

  // Try to find existing company by multiple criteria
  let company = await prisma.company.findFirst({
    where: {
      OR: [
        { slug },
        { slug: slugify(data.name) }, // Original slug too
        ...(data.linkedinUrl ? [{ linkedinUrl: data.linkedinUrl }] : []),
        { name: { equals: data.name, mode: 'insensitive' } },
        { name: { equals: normalizedName, mode: 'insensitive' } },
        // Also search with contains for partial matches
        { name: { contains: normalizedName, mode: 'insensitive' } },
      ],
    },
  });

  if (company) {
    // Update website if missing and we have email domain
    if (!company.website && data.email) {
      const domain = extractDomainFromEmail(data.email);
      if (domain) {
        await prisma.company.update({
          where: { id: company.id },
          data: { website: `https://${domain}` },
        });
        company.website = `https://${domain}`;
      }
    }
    return company;
  }

  // Derive website from email domain
  let website: string | null = null;
  if (data.email) {
    const domain = extractDomainFromEmail(data.email);
    if (domain) {
      website = `https://${domain}`;
    }
  }

  // Create new company with website from email domain
  company = await prisma.company.create({
    data: {
      slug: await generateUniqueSlug(slug, 'company'),
      name: normalizedName, // Use normalized name
      linkedinUrl: data.linkedinUrl,
      website, // Set website from email domain for Logo.dev fallback
      verified: false,
    },
  });

  return company;
}

// Generate unique slug
async function generateUniqueSlug(base: string, type: 'job' | 'company' = 'job'): Promise<string> {
  let slug = base;
  let counter = 1;

  while (true) {
    const exists = type === 'job'
      ? await prisma.job.findUnique({ where: { slug } })
      : await prisma.company.findUnique({ where: { slug } });

    if (!exists) return slug;

    slug = `${base}-${counter}`;
    counter++;
  }
}

// Map location type
function mapLocationType(isRemote: boolean, location: string | null): 'REMOTE' | 'REMOTE_US' | 'REMOTE_EU' | 'REMOTE_COUNTRY' | 'HYBRID' | 'ONSITE' {
  if (!isRemote) return 'ONSITE';

  const loc = location?.toLowerCase() || '';
  if (loc.includes('us only') || loc.includes('usa only') || loc.includes('united states only')) return 'REMOTE_US';
  if (loc.includes('eu only') || loc.includes('europe only') || loc.includes('emea')) return 'REMOTE_EU';
  if (location && location.toLowerCase() !== 'remote' && location.toLowerCase() !== 'worldwide') return 'REMOTE_COUNTRY';

  return 'REMOTE';
}

// Extract country code
function extractCountryCode(location: string | null): string | null {
  if (!location) return null;

  const countryMap: Record<string, string> = {
    'usa': 'US', 'united states': 'US', 'us': 'US',
    'uk': 'GB', 'united kingdom': 'GB',
    'canada': 'CA',
    'germany': 'DE',
    'france': 'FR',
    'netherlands': 'NL',
    'spain': 'ES',
    'italy': 'IT',
    'australia': 'AU',
    'india': 'IN',
    'brazil': 'BR',
    'mexico': 'MX',
    'poland': 'PL',
    'portugal': 'PT',
    'ireland': 'IE',
    'sweden': 'SE',
    'switzerland': 'CH',
  };

  const loc = location.toLowerCase();
  for (const [key, code] of Object.entries(countryMap)) {
    if (loc.includes(key)) {
      return code;
    }
  }

  return null;
}

// Calculate quality score
function calculateQualityScore(extracted: ExtractedJobData, post: LinkedInPost): number {
  let score = 40; // Base score for LinkedIn posts

  if (extracted.title) score += 15;
  if (extracted.company) score += 10;
  if (extracted.salaryMin || extracted.salaryMax) score += 15;
  if (extracted.skills.length > 0) score += 5;
  if (extracted.skills.length > 3) score += 5;
  if (extracted.benefits.length > 0) score += 5;
  if (extracted.contactEmail || extracted.applyUrl) score += 5;

  // Penalties
  if (!extracted.level) score -= 5;
  if (!extracted.isRemote && !extracted.location) score -= 10;

  return Math.max(0, Math.min(100, score));
}

export { processLinkedInPost };
