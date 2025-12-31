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
import { ensureSalaryData } from '@/lib/salary-estimation';
import { validateAndEnrichCompany } from '@/services/company-enrichment';
import { cleanupOldJobs, cleanupOldParsingLogs, cleanupOrphanedCompanies } from '@/services/job-cleanup';
import { buildJobUrl, notifySearchEngines } from '@/lib/indexing';
import { sendInstantAlertsForJob } from '@/services/alert-notifications';
import { addToSocialQueue } from '@/services/social-post';
import { shouldSkipJob } from '@/lib/job-filter';
import type { FilterReason } from '@prisma/client';

// Re-export for cron endpoint
export { HIRING_SEARCH_QUERIES };

interface ProcessedJob {
  success: boolean;
  jobId?: string;
  companySlug?: string;
  jobSlug?: string;
  error?: string;
}

interface FilteredJobInfo {
  title: string;
  company: string;
  location: string | null;
  sourceUrl: string | null;
  reason: FilterReason;
}

interface ProcessingStats {
  total: number;
  processed: number;
  created: number;
  skipped: number;
  failed: number;
  errors: string[];
  createdJobUrls: string[];
  createdJobIds: string[];
  filteredJobs: FilteredJobInfo[];
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
    createdJobIds: [],
    filteredJobs: [],
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

    // Save ImportedJob records
    if (stats.createdJobIds.length > 0) {
      await prisma.importedJob.createMany({
        data: stats.createdJobIds.map((jobId) => ({
          importLogId: importLog.id,
          jobId,
        })),
        skipDuplicates: true,
      });
    }

    // Save FilteredJob records
    if (stats.filteredJobs.length > 0) {
      await prisma.filteredJob.createMany({
        data: stats.filteredJobs.map((fj) => ({
          importLogId: importLog.id,
          title: fj.title,
          company: fj.company,
          location: fj.location,
          sourceUrl: fj.sourceUrl,
          reason: fj.reason,
        })),
      });
    }

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

    // Cleanup old jobs and orphaned companies after successful import
    await cleanupOldJobs();
    await cleanupOrphanedCompanies();
    await cleanupOldParsingLogs();

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
    createdJobIds: [],
    filteredJobs: [],
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

    // Save ImportedJob records
    if (stats.createdJobIds.length > 0) {
      await prisma.importedJob.createMany({
        data: stats.createdJobIds.map((jobId) => ({
          importLogId: importLog.id,
          jobId,
        })),
        skipDuplicates: true,
      });
    }

    // Save FilteredJob records
    if (stats.filteredJobs.length > 0) {
      await prisma.filteredJob.createMany({
        data: stats.filteredJobs.map((fj) => ({
          importLogId: importLog.id,
          title: fj.title,
          company: fj.company,
          location: fj.location,
          sourceUrl: fj.sourceUrl,
          reason: fj.reason,
        })),
      });
    }

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

    // Cleanup old jobs and orphaned companies after successful import
    await cleanupOldJobs();
    await cleanupOrphanedCompanies();
    await cleanupOldParsingLogs();

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
    createdJobIds: [],
    filteredJobs: [],
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

    // Save ImportedJob records
    if (stats.createdJobIds.length > 0) {
      await prisma.importedJob.createMany({
        data: stats.createdJobIds.map((jobId) => ({
          importLogId: importLog.id,
          jobId,
        })),
        skipDuplicates: true,
      });
    }

    // Save FilteredJob records
    if (stats.filteredJobs.length > 0) {
      await prisma.filteredJob.createMany({
        data: stats.filteredJobs.map((fj) => ({
          importLogId: importLog.id,
          title: fj.title,
          company: fj.company,
          location: fj.location,
          sourceUrl: fj.sourceUrl,
          reason: fj.reason,
        })),
      });
    }

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

    // Cleanup old jobs and orphaned companies after successful import
    await cleanupOldJobs();
    await cleanupOrphanedCompanies();
    await cleanupOldParsingLogs();

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

// Map error message to FilterReason
function mapErrorToFilterReason(error: string): FilterReason | null {
  if (error === 'duplicate') return 'DUPLICATE';
  if (error.includes('No corporate email')) return 'NO_EMAIL';
  if (error.includes('Could not extract job title')) return 'NO_TITLE';
  if (error.includes('Company validation failed')) return 'NO_EMAIL'; // Apollo validation = no legit company
  if (error.includes('non-target')) return 'NON_TARGET_TITLE';
  if (error.includes('physical') || error.includes('ONSITE') || error.includes('HYBRID')) return 'PHYSICAL_LOCATION';
  return 'OTHER';
}

// Process a batch of posts
async function processPostsBatch(posts: LinkedInPost[], stats: ProcessingStats): Promise<void> {
  for (const post of posts) {
    try {
      const result = await processLinkedInPost(post);
      stats.processed++;

      if (result.success && result.jobId) {
        stats.created++;
        stats.createdJobIds.push(result.jobId);
        if (result.companySlug && result.jobSlug) {
          stats.createdJobUrls.push(buildJobUrl(result.companySlug, result.jobSlug));
        }
      } else if (result.error === 'duplicate') {
        stats.skipped++;
        // Log duplicates as skipped
        stats.filteredJobs.push({
          title: post.content.slice(0, 100),
          company: post.authorName || 'Unknown',
          location: null,
          sourceUrl: post.url,
          reason: 'DUPLICATE',
        });
      } else {
        stats.failed++;
        if (result.error) {
          stats.errors.push(result.error);
          // Track filtered job
          const reason = mapErrorToFilterReason(result.error);
          if (reason) {
            stats.filteredJobs.push({
              title: post.content.slice(0, 100), // First 100 chars as title
              company: post.authorName || 'Unknown',
              location: null,
              sourceUrl: post.url,
              reason,
            });
          }
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

  // =========================================================================
  // EARLY FILTERS - before expensive company/Apollo operations
  // =========================================================================

  // Map location type first (needed for filter)
  const locationType = mapLocationType(extracted.isRemote, extracted.location);

  // Apply global job filter (non-target titles, HYBRID/ONSITE, physical locations)
  const filterResult = shouldSkipJob({
    title: extracted.title,
    location: extracted.location,
    locationType,
  });
  if (filterResult.skip) {
    return { success: false, error: `${filterResult.reason} - skipped` };
  }

  // Get company name - EMAIL DOMAIN IS SOURCE OF TRUTH (who is actually hiring)
  // Priority: email domain → DeepSeek extraction → headline → author name
  const emailCompany = extractCompanyFromEmail(validatedEmail);
  const extractedCompany = isGenericCompanyName(extracted.company) ? null : extracted.company;

  const companyName = emailCompany ||
    extractedCompany ||
    extractCompanyFromHeadline(post.authorHeadline) ||
    post.authorName;

  // Check for duplicate job by title + company BEFORE creating company
  // This saves Apollo API calls for duplicates
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  const companySlugForDedup = slugify(companyName);
  const duplicateByTitle = await prisma.job.findFirst({
    where: {
      OR: [
        { company: { slug: companySlugForDedup } },
        { company: { name: { equals: companyName, mode: 'insensitive' } } },
      ],
      title: { equals: extracted.title, mode: 'insensitive' },
      createdAt: { gte: tenDaysAgo },
    },
  });

  if (duplicateByTitle) {
    return { success: false, error: 'duplicate' };
  }

  // =========================================================================
  // EXPENSIVE OPERATIONS - only after passing all filters
  // =========================================================================

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

  // Fetch company headquarters for country extraction
  const companyWithHQ = await prisma.company.findUnique({
    where: { id: company.id },
    select: { headquarters: true },
  });

  // Get country code from location, description, or company HQ
  const countryCode = extractCountryCode(extracted.location, post.content, companyWithHQ?.headquarters);

  // Get actual or estimated salary data
  const salaryData = extracted.salaryMin ? {
    salaryMin: extracted.salaryMin,
    salaryMax: extracted.salaryMax,
    salaryCurrency: extracted.salaryCurrency || 'USD',
    salaryPeriod: extracted.salaryPeriod || 'YEAR',
    salaryIsEstimate: false,
  } : ensureSalaryData({ salaryMin: null }, category.slug, extracted.level || 'MID', countryCode);

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
        country: countryCode,
        level: extracted.level || 'MID',
        type: extracted.type || 'FULL_TIME',
        ...salaryData,
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

  // Submit to Google Indexing API (non-blocking)
  const jobUrl = buildJobUrl(company.slug, slug);
  notifySearchEngines([jobUrl]).catch((err) => {
    console.error('[LinkedIn] Search engine notification failed:', err);
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

// Map location type - default to REMOTE for remote job board
function mapLocationType(isRemote: boolean, location: string | null): 'REMOTE' | 'REMOTE_US' | 'REMOTE_EU' | 'REMOTE_COUNTRY' | 'HYBRID' | 'ONSITE' {
  const loc = location?.toLowerCase() || '';

  // Check for explicit on-site indicators
  const onsiteKeywords = ['on-site', 'onsite', 'in-office', 'office-based', 'in office', 'at office', 'office location'];
  const isExplicitlyOnsite = onsiteKeywords.some(kw => loc.includes(kw));

  // For remote job board: default to REMOTE unless explicitly on-site
  if (isExplicitlyOnsite && !isRemote) {
    return 'ONSITE';
  }

  // Determine remote type based on location
  if (loc.includes('us only') || loc.includes('usa only') || loc.includes('united states only')) return 'REMOTE_US';
  if (loc.includes('eu only') || loc.includes('europe only') || loc.includes('emea')) return 'REMOTE_EU';
  if (location && !['remote', 'worldwide', 'anywhere'].includes(loc)) return 'REMOTE_COUNTRY';

  return 'REMOTE';
}

// Comprehensive country mapping (30 countries)
const COUNTRY_MAP: Record<string, string> = {
  // North America
  'usa': 'US', 'united states': 'US', 'u.s.': 'US', 'america': 'US',
  'canada': 'CA', 'canadian': 'CA',
  'mexico': 'MX', 'méxico': 'MX',
  // Western Europe
  'uk': 'GB', 'united kingdom': 'GB', 'britain': 'GB', 'england': 'GB', 'scotland': 'GB', 'wales': 'GB',
  'germany': 'DE', 'deutschland': 'DE', 'german': 'DE',
  'france': 'FR', 'french': 'FR', 'française': 'FR',
  'netherlands': 'NL', 'holland': 'NL', 'dutch': 'NL', 'nederland': 'NL',
  'belgium': 'BE', 'belgian': 'BE', 'belgique': 'BE',
  'switzerland': 'CH', 'swiss': 'CH', 'schweiz': 'CH', 'suisse': 'CH',
  'austria': 'AT', 'austrian': 'AT', 'österreich': 'AT',
  'ireland': 'IE', 'irish': 'IE', 'eire': 'IE',
  // Southern Europe
  'spain': 'ES', 'spanish': 'ES', 'españa': 'ES',
  'portugal': 'PT', 'portuguese': 'PT',
  'italy': 'IT', 'italian': 'IT', 'italia': 'IT',
  'greece': 'GR', 'greek': 'GR', 'ελλάδα': 'GR', 'hellas': 'GR',
  'croatia': 'HR', 'croatian': 'HR', 'hrvatska': 'HR',
  'slovenia': 'SI', 'slovenian': 'SI', 'slovenija': 'SI',
  // Northern Europe
  'sweden': 'SE', 'swedish': 'SE', 'sverige': 'SE',
  'denmark': 'DK', 'danish': 'DK', 'danmark': 'DK',
  'norway': 'NO', 'norwegian': 'NO', 'norge': 'NO',
  'finland': 'FI', 'finnish': 'FI', 'suomi': 'FI',
  // Eastern Europe
  'poland': 'PL', 'polish': 'PL', 'polska': 'PL',
  'ukraine': 'UA', 'ukrainian': 'UA', 'україна': 'UA',
  'romania': 'RO', 'romanian': 'RO', 'românia': 'RO',
  'czech republic': 'CZ', 'czechia': 'CZ', 'czech': 'CZ', 'česko': 'CZ',
  'hungary': 'HU', 'hungarian': 'HU', 'magyarország': 'HU',
  'bulgaria': 'BG', 'bulgarian': 'BG', 'българия': 'BG',
  'slovakia': 'SK', 'slovak': 'SK', 'slovensko': 'SK',
  'serbia': 'RS', 'serbian': 'RS', 'србија': 'RS',
  'lithuania': 'LT', 'lithuanian': 'LT', 'lietuva': 'LT',
  'latvia': 'LV', 'latvian': 'LV', 'latvija': 'LV',
  'estonia': 'EE', 'estonian': 'EE', 'eesti': 'EE',
  // Asia Pacific
  'australia': 'AU', 'australian': 'AU', 'aussie': 'AU',
  'singapore': 'SG', 'singaporean': 'SG',
  'japan': 'JP', 'japanese': 'JP', '日本': 'JP',
  'india': 'IN', 'indian': 'IN', 'भारत': 'IN',
  // Middle East
  'israel': 'IL', 'israeli': 'IL', 'ישראל': 'IL',
  'uae': 'AE', 'united arab emirates': 'AE', 'dubai': 'AE', 'abu dhabi': 'AE', 'emirates': 'AE',
  // Latin America
  'brazil': 'BR', 'brazilian': 'BR', 'brasil': 'BR',
  'argentina': 'AR', 'argentine': 'AR', 'argentinian': 'AR',
};

// Major cities mapped to countries
const CITY_COUNTRY_MAP: Record<string, string> = {
  // US cities
  'new york': 'US', 'nyc': 'US', 'san francisco': 'US', 'sf': 'US', 'los angeles': 'US', 'la': 'US',
  'chicago': 'US', 'seattle': 'US', 'austin': 'US', 'boston': 'US', 'denver': 'US', 'miami': 'US',
  'atlanta': 'US', 'dallas': 'US', 'houston': 'US', 'phoenix': 'US', 'silicon valley': 'US',
  'san diego': 'US', 'portland': 'US', 'philadelphia': 'US', 'washington dc': 'US', 'dc': 'US',
  // UK cities
  'london': 'GB', 'manchester': 'GB', 'edinburgh': 'GB', 'birmingham': 'GB', 'bristol': 'GB', 'cambridge': 'GB', 'oxford': 'GB',
  // German cities
  'berlin': 'DE', 'munich': 'DE', 'münchen': 'DE', 'hamburg': 'DE', 'frankfurt': 'DE', 'cologne': 'DE', 'köln': 'DE', 'düsseldorf': 'DE',
  // French cities
  'paris': 'FR', 'lyon': 'FR', 'marseille': 'FR', 'toulouse': 'FR', 'bordeaux': 'FR', 'nantes': 'FR',
  // Dutch cities
  'amsterdam': 'NL', 'rotterdam': 'NL', 'utrecht': 'NL', 'eindhoven': 'NL', 'the hague': 'NL',
  // Spanish cities
  'barcelona': 'ES', 'madrid': 'ES', 'valencia': 'ES', 'seville': 'ES', 'malaga': 'ES', 'bilbao': 'ES',
  // Italian cities
  'milan': 'IT', 'milano': 'IT', 'rome': 'IT', 'roma': 'IT', 'turin': 'IT', 'florence': 'IT', 'bologna': 'IT',
  // Canadian cities
  'toronto': 'CA', 'vancouver': 'CA', 'montreal': 'CA', 'ottawa': 'CA', 'calgary': 'CA', 'waterloo': 'CA',
  // Australian cities
  'sydney': 'AU', 'melbourne': 'AU', 'brisbane': 'AU', 'perth': 'AU', 'adelaide': 'AU',
  // Indian cities
  'bangalore': 'IN', 'bengaluru': 'IN', 'mumbai': 'IN', 'delhi': 'IN', 'new delhi': 'IN', 'hyderabad': 'IN', 'pune': 'IN', 'chennai': 'IN',
  // Other European cities
  'tel aviv': 'IL', 'warsaw': 'PL', 'krakow': 'PL', 'kraków': 'PL', 'wroclaw': 'PL', 'gdansk': 'PL',
  'lisbon': 'PT', 'porto': 'PT',
  'stockholm': 'SE', 'gothenburg': 'SE', 'malmö': 'SE',
  'copenhagen': 'DK', 'aarhus': 'DK',
  'oslo': 'NO', 'bergen': 'NO',
  'helsinki': 'FI', 'tampere': 'FI',
  'zurich': 'CH', 'zürich': 'CH', 'geneva': 'CH', 'basel': 'CH', 'bern': 'CH',
  'vienna': 'AT', 'wien': 'AT', 'salzburg': 'AT', 'graz': 'AT',
  'brussels': 'BE', 'antwerp': 'BE', 'ghent': 'BE',
  'dublin': 'IE', 'cork': 'IE', 'galway': 'IE',
  'prague': 'CZ', 'praha': 'CZ', 'brno': 'CZ',
  'bucharest': 'RO', 'cluj': 'RO', 'timisoara': 'RO',
  'kyiv': 'UA', 'kiev': 'UA', 'lviv': 'UA', 'kharkiv': 'UA',
  // Greek cities
  'athens': 'GR', 'thessaloniki': 'GR', 'patras': 'GR',
  // Hungarian cities
  'budapest': 'HU', 'debrecen': 'HU',
  // Bulgarian cities
  'sofia': 'BG', 'plovdiv': 'BG', 'varna': 'BG',
  // Other Eastern European
  'bratislava': 'SK', 'belgrade': 'RS', 'zagreb': 'HR', 'ljubljana': 'SI',
  'vilnius': 'LT', 'riga': 'LV', 'tallinn': 'EE',
  // Asian cities
  'tokyo': 'JP', 'osaka': 'JP', 'kyoto': 'JP',
  // Latin American cities
  'são paulo': 'BR', 'sao paulo': 'BR', 'rio de janeiro': 'BR', 'rio': 'BR',
  'buenos aires': 'AR', 'mexico city': 'MX', 'ciudad de méxico': 'MX',
};

// US state abbreviations
const US_STATES = [
  'alabama', 'al', 'alaska', 'ak', 'arizona', 'az', 'arkansas', 'ar', 'california', 'ca',
  'colorado', 'co', 'connecticut', 'ct', 'delaware', 'de', 'florida', 'fl', 'georgia', 'ga',
  'hawaii', 'hi', 'idaho', 'id', 'illinois', 'il', 'indiana', 'in', 'iowa', 'ia',
  'kansas', 'ks', 'kentucky', 'ky', 'louisiana', 'la', 'maine', 'me', 'maryland', 'md',
  'massachusetts', 'ma', 'michigan', 'mi', 'minnesota', 'mn', 'mississippi', 'ms', 'missouri', 'mo',
  'montana', 'mt', 'nebraska', 'ne', 'nevada', 'nv', 'new hampshire', 'nh', 'new jersey', 'nj',
  'new mexico', 'nm', 'new york', 'ny', 'north carolina', 'nc', 'north dakota', 'nd', 'ohio', 'oh',
  'oklahoma', 'ok', 'oregon', 'or', 'pennsylvania', 'pa', 'rhode island', 'ri', 'south carolina', 'sc',
  'south dakota', 'sd', 'tennessee', 'tn', 'texas', 'tx', 'utah', 'ut', 'vermont', 'vt',
  'virginia', 'va', 'washington', 'wa', 'west virginia', 'wv', 'wisconsin', 'wi', 'wyoming', 'wy',
];

/**
 * Extract country code from text (location, description, or headquarters)
 */
function extractCountryCode(location: string | null, description?: string | null, headquarters?: string | null): string | null {
  // Try location first
  if (location) {
    const code = extractCountryFromText(location);
    if (code) return code;
  }

  // Try headquarters
  if (headquarters) {
    const code = extractCountryFromText(headquarters);
    if (code) return code;
  }

  // Try description (only first 500 chars to avoid false matches)
  if (description) {
    const code = extractCountryFromText(description.slice(0, 500));
    if (code) return code;
  }

  return null;
}

/**
 * Extract country code from a text string
 */
function extractCountryFromText(text: string): string | null {
  const normalized = text.toLowerCase();

  // Check country names first
  for (const [key, code] of Object.entries(COUNTRY_MAP)) {
    // Use word boundary matching to avoid partial matches
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(normalized)) {
      return code;
    }
  }

  // Check city names
  for (const [city, code] of Object.entries(CITY_COUNTRY_MAP)) {
    const regex = new RegExp(`\\b${city}\\b`, 'i');
    if (regex.test(normalized)) {
      return code;
    }
  }

  // Check US states (indicates US)
  for (const state of US_STATES) {
    // Match state names or 2-letter codes with comma before (e.g., ", CA" or ", California")
    if (state.length === 2) {
      // For 2-letter codes, require comma before to avoid false positives
      if (normalized.includes(`, ${state}`) || normalized.includes(`,${state}`)) {
        return 'US';
      }
    } else {
      const regex = new RegExp(`\\b${state}\\b`, 'i');
      if (regex.test(normalized)) {
        return 'US';
      }
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
