import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractJobData, classifyJobCategory, type ExtractedJobData } from '@/lib/deepseek';
import { slugify, isFreeEmail, extractDomainFromEmail, cleanEmail } from '@/lib/utils';
import { validateAndEnrichCompany } from '@/services/company-enrichment';
import { buildJobUrl, notifySearchEngines } from '@/lib/indexing';
import { sendInstantAlertsForJob } from '@/services/alert-notifications';
import { addToSocialQueue } from '@/services/social-post';

/**
 * POST /api/webhooks/linkedin-posts
 *
 * Webhook endpoint for receiving LinkedIn posts from n8n workflow.
 * Processes individual posts and creates jobs.
 *
 * Expected body (flat fields from n8n):
 * {
 *   postUrl: string,
 *   postContent: string,
 *   "author.linkedinUrl": string,
 *   "author.name": string,
 *   "author.info": string | null,
 *   "author.type": "profile" | "company",
 *   "author.avatar.url": string | null
 * }
 *
 * Query params:
 * - secret: Webhook secret for authentication
 */

interface N8nPostPayload {
  // Support both formats: n8n mapped fields OR raw Apify fields
  postUrl?: string;
  postContent?: string;
  linkedinUrl?: string;  // Apify raw field
  content?: string;      // Apify raw field
  // Author fields (flat from n8n)
  'author.linkedinUrl'?: string;
  'author.name'?: string;
  'author.info'?: string;
  'author.type'?: string;
  'author.avatar.url'?: string;
  // Author fields (nested from Apify)
  authorLinkedinUrl?: string;
  authorName?: string;
  authorInfo?: string;
  authorType?: string;
  author?: {
    linkedinUrl?: string;
    name?: string;
    info?: string;
    type?: string;
    avatar?: { url?: string };
  };
}

export async function POST(request: NextRequest) {
  // Verify webhook secret
  const secret = request.nextUrl.searchParams.get('secret');
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET || process.env.APIFY_WEBHOOK_SECRET;

  if (webhookSecret && secret !== webhookSecret) {
    console.error('[LinkedInPosts] Invalid webhook secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: N8nPostPayload = await request.json();

    // Normalize fields - support both n8n mapped and raw Apify formats
    const postUrl = body.postUrl || body.linkedinUrl;
    const postContent = body.postContent || body.content;
    const authorLinkedInUrl = body['author.linkedinUrl'] || body.authorLinkedinUrl || body.author?.linkedinUrl;
    const authorName = body['author.name'] || body.authorName || body.author?.name || 'Unknown';
    const authorHeadline = body['author.info'] || body.authorInfo || body.author?.info || null;

    // Validate required fields - return 200 OK but skip if empty (don't break n8n flow)
    if (!postUrl || !postContent) {
      console.log('[LinkedInPosts] Skipping post with empty data');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'empty_data',
      });
    }

    console.log(`[LinkedInPosts] Processing post: ${postUrl}`);

    // Extract post ID from URL
    const postId = extractPostId(postUrl);

    // Check if already exists
    const existingJob = await prisma.job.findFirst({
      where: {
        OR: [
          { sourceId: postId },
          { sourceUrl: postUrl },
        ],
      },
    });

    if (existingJob) {
      console.log(`[LinkedInPosts] Duplicate post, skipping: ${postId}`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'duplicate',
      });
    }

    // Extract job data using DeepSeek
    console.log(`[LinkedInPosts] Extracting data from post...`);
    const extracted = await extractJobData(postContent);

    if (!extracted || !extracted.title) {
      console.log(`[LinkedInPosts] Could not extract job title`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'no_title',
      });
    }

    // Clean and validate email (handles AI-extracted emails with extra text)
    const validatedEmail = cleanEmail(extracted.contactEmail);

    // Skip jobs without corporate email
    if (!validatedEmail || isFreeEmail(validatedEmail)) {
      console.log(`[LinkedInPosts] No corporate email, skipping`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'no_corporate_email',
      });
    }

    // Check for similar job from same company (by email domain)
    const hasSimilarJob = await findSimilarJobByEmailDomain(
      validatedEmail,
      extracted.title
    );

    if (hasSimilarJob) {
      console.log(`[LinkedInPosts] Similar job already exists, skipping`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'similar_job_exists',
      });
    }

    // Validate extracted company name - ignore generic terms
    const extractedCompany = isGenericCompanyName(extracted.company) ? null : extracted.company;

    // Get company name - EMAIL DOMAIN IS SOURCE OF TRUTH (who is actually hiring)
    // Priority: email domain → DeepSeek extraction → headline → author name
    const emailCompany = extractCompanyFromEmail(validatedEmail);
    const companyName = emailCompany ||
      extractedCompany ||
      extractCompanyFromHeadline(authorHeadline) ||
      authorName;

    // Find or create company (with email for website fallback)
    const company = await findOrCreateCompany({
      name: companyName,
      linkedinUrl: authorLinkedInUrl,
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
      console.log(`[LinkedInPosts] Company validation failed: ${validatedEmail}`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'company_validation_failed',
      });
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
      console.log(`[LinkedInPosts] Duplicate job by title+company, skipping`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'duplicate_title',
      });
    }

    // Classify category
    const categorySlug = await classifyJobCategory(extracted.title, extracted.skills);
    let category = await prisma.category.findUnique({ where: { slug: categorySlug } });

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
      console.log(`[LinkedInPosts] ONSITE job, skipping`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'onsite_job',
      });
    }

    // Create job (with unique constraint handling for race conditions)
    let job;
    try {
      job = await prisma.job.create({
        data: {
          slug,
          title: extracted.title,
          description: postContent,
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
          sourceUrl: postUrl,
          sourceId: postId,
          originalContent: postContent,
          authorLinkedIn: authorLinkedInUrl,
          authorName: authorName,
          applyEmail: validatedEmail,
          applyUrl: extracted.applyUrl,
          enrichmentStatus: 'COMPLETED',
          qualityScore: calculateQualityScore(extracted),
          postedAt: new Date(),
        },
      });
    } catch (createError: unknown) {
      // Handle unique constraint violation (race condition - another request created the same job)
      if (
        createError &&
        typeof createError === 'object' &&
        'code' in createError &&
        createError.code === 'P2002'
      ) {
        console.log(`[LinkedInPosts] Duplicate job (unique constraint), skipping: ${extracted.title}`);
        return NextResponse.json({
          success: true,
          status: 'skipped',
          reason: 'duplicate_constraint',
        });
      }
      throw createError;
    }

    console.log(`[LinkedInPosts] Created job: ${job.slug}`);

    // Note: Company enrichment is already done in validateAndEnrichCompany()

    // Notify search engines
    try {
      await notifySearchEngines([buildJobUrl(company.slug, job.slug)]);
    } catch (indexError) {
      console.error('[LinkedInPosts] Search engine notification failed:', indexError);
    }

    // Send INSTANT alerts for this job (non-blocking)
    sendInstantAlertsForJob(job.id).catch((err) => {
      console.error('[LinkedInPosts] Instant alerts failed:', err);
    });

    // Add to social post queue (non-blocking)
    addToSocialQueue(job.id).catch((err) => {
      console.error('[LinkedInPosts] Social queue failed:', err);
    });

    return NextResponse.json({
      success: true,
      status: 'created',
      jobId: job.id,
      jobSlug: job.slug,
      companySlug: company.slug,
    });
  } catch (error) {
    console.error('[LinkedInPosts] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process post', details: String(error) },
      { status: 500 }
    );
  }
}

// Extract post ID from LinkedIn URL
function extractPostId(url: string): string {
  // URLs like: https://www.linkedin.com/feed/update/urn:li:activity:1234567890/
  const activityMatch = url.match(/activity:(\d+)/);
  if (activityMatch) return activityMatch[1];

  // URLs like: https://www.linkedin.com/posts/username_...
  const postsMatch = url.match(/posts\/([^\/\?]+)/);
  if (postsMatch) return postsMatch[1];

  // Fallback: use URL hash
  return url.replace(/[^a-zA-Z0-9]/g, '').slice(-20);
}

// Extract company from headline
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
    design: 'Design',
    data: 'Data',
    devops: 'DevOps',
    qa: 'QA',
    security: 'Security',
    product: 'Product',
    marketing: 'Marketing',
    sales: 'Sales',
    finance: 'Finance',
    hr: 'HR',
    operations: 'Operations',
    legal: 'Legal',
    'project-management': 'Project Management',
    writing: 'Writing',
    translation: 'Translation',
    creative: 'Creative',
    support: 'Support',
    education: 'Education',
    research: 'Research',
    consulting: 'Consulting',
  };
  return names[slug] || slug;
}

// Normalize company name
function normalizeCompanyName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/, '')
    .replace(/\s*[-–—]\s*Engineering.*$/i, '')
    .replace(/\s*[-–—]\s*Technology.*$/i, '')
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

  let company = await prisma.company.findFirst({
    where: {
      OR: [
        { slug },
        { slug: slugify(data.name) },
        ...(data.linkedinUrl ? [{ linkedinUrl: data.linkedinUrl }] : []),
        { name: { equals: data.name, mode: 'insensitive' as const } },
        { name: { equals: normalizedName, mode: 'insensitive' as const } },
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
      name: normalizedName,
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
  if (loc.includes('us only') || loc.includes('usa only')) return 'REMOTE_US';
  if (loc.includes('eu only') || loc.includes('europe only')) return 'REMOTE_EU';
  if (location && !['remote', 'worldwide', 'anywhere'].includes(loc)) return 'REMOTE_COUNTRY';

  return 'REMOTE';
}

// Extract country code
function extractCountryCode(location: string | null): string | null {
  if (!location) return null;

  const countryMap: Record<string, string> = {
    'usa': 'US', 'united states': 'US', 'us': 'US',
    'uk': 'GB', 'united kingdom': 'GB',
    'canada': 'CA', 'germany': 'DE', 'france': 'FR',
    'netherlands': 'NL', 'spain': 'ES', 'italy': 'IT',
    'australia': 'AU', 'india': 'IN', 'brazil': 'BR',
    'mexico': 'MX', 'poland': 'PL', 'portugal': 'PT',
    'ireland': 'IE', 'sweden': 'SE', 'switzerland': 'CH',
  };

  const loc = location.toLowerCase();
  for (const [key, code] of Object.entries(countryMap)) {
    if (loc.includes(key)) return code;
  }

  return null;
}

// Calculate quality score
function calculateQualityScore(extracted: ExtractedJobData): number {
  let score = 40;

  if (extracted.title) score += 15;
  if (extracted.company) score += 10;
  if (extracted.salaryMin || extracted.salaryMax) score += 15;
  if (extracted.skills.length > 0) score += 5;
  if (extracted.skills.length > 3) score += 5;
  if (extracted.benefits.length > 0) score += 5;
  if (extracted.contactEmail || extracted.applyUrl) score += 5;
  if (!extracted.level) score -= 5;
  if (!extracted.isRemote && !extracted.location) score -= 10;

  return Math.max(0, Math.min(100, score));
}

// Calculate title similarity (simple word overlap)
function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const words1 = new Set(normalize(title1));
  const words2 = new Set(normalize(title2));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = [...words1].filter(w => words2.has(w)).length;
  const union = new Set([...words1, ...words2]).size;

  return intersection / union; // Jaccard similarity
}

// Check for similar job by email domain
async function findSimilarJobByEmailDomain(
  email: string,
  title: string,
  threshold: number = 0.6
): Promise<boolean> {
  const domain = extractDomainFromEmail(email);
  if (!domain) return false;

  // Find recent jobs with same email domain
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentJobs = await prisma.job.findMany({
    where: {
      applyEmail: { endsWith: `@${domain}` },
      createdAt: { gte: thirtyDaysAgo },
    },
    select: { title: true },
    take: 50,
  });

  for (const job of recentJobs) {
    const similarity = calculateTitleSimilarity(title, job.title);
    if (similarity >= threshold) {
      console.log(`[LinkedInPosts] Similar job found: "${job.title}" (similarity: ${(similarity * 100).toFixed(0)}%)`);
      return true;
    }
  }

  return false;
}

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET || process.env.APIFY_WEBHOOK_SECRET;

  if (webhookSecret && secret !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'ok',
    message: 'LinkedIn Posts webhook endpoint is ready',
    usage: {
      method: 'POST',
      url: '/api/webhooks/linkedin-posts?secret=YOUR_SECRET',
      body: {
        postUrl: 'LinkedIn post URL',
        postContent: 'Post content text',
        'author.linkedinUrl': 'Author LinkedIn URL',
        'author.name': 'Author name',
        'author.info': 'Author headline (optional)',
        'author.type': 'profile or company',
        'author.avatar.url': 'Avatar URL (optional)',
      },
    },
  });
}
