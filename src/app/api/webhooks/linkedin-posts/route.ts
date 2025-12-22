import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractJobData, classifyJobCategory, type ExtractedJobData } from '@/lib/deepseek';
import { slugify, isFreeEmail } from '@/lib/utils';
import { queueCompanyEnrichment } from '@/services/company-enrichment';
import { buildJobUrl, notifySearchEngines } from '@/lib/indexing';

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
  postUrl: string;
  postContent: string;
  'author.linkedinUrl'?: string;
  'author.name'?: string;
  'author.info'?: string;
  'author.type'?: string;
  'author.avatar.url'?: string;
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

    // Validate required fields - return 200 OK but skip if empty (don't break n8n flow)
    if (!body.postUrl || !body.postContent) {
      console.log('[LinkedInPosts] Skipping post with empty data');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'empty_data',
      });
    }

    console.log(`[LinkedInPosts] Processing post: ${body.postUrl}`);

    // Extract post ID from URL
    const postId = extractPostId(body.postUrl);

    // Check if already exists
    const existingJob = await prisma.job.findFirst({
      where: {
        OR: [
          { sourceId: postId },
          { sourceUrl: body.postUrl },
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
    const extracted = await extractJobData(body.postContent);

    if (!extracted || !extracted.title) {
      console.log(`[LinkedInPosts] Could not extract job title`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'no_title',
      });
    }

    // Skip jobs without corporate email
    if (!extracted.contactEmail || isFreeEmail(extracted.contactEmail)) {
      console.log(`[LinkedInPosts] No corporate email, skipping`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'no_corporate_email',
      });
    }

    // Get author info from n8n flat fields
    const authorName = body['author.name'] || 'Unknown';
    const authorLinkedInUrl = body['author.linkedinUrl'] || null;
    const authorHeadline = body['author.info'] || null;

    // Get company name
    const companyName = extracted.company ||
      extractCompanyFromHeadline(authorHeadline) ||
      authorName;

    // Find or create company
    const company = await findOrCreateCompany({
      name: companyName,
      linkedinUrl: authorLinkedInUrl,
    });

    // Check for duplicate job by title + company
    const duplicateByTitle = await prisma.job.findFirst({
      where: {
        companyId: company.id,
        title: { equals: extracted.title, mode: 'insensitive' },
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

    // Create job
    const job = await prisma.job.create({
      data: {
        slug,
        title: extracted.title,
        description: body.postContent,
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
        source: 'LINKEDIN',
        sourceType: 'UNSTRUCTURED',
        sourceUrl: body.postUrl,
        sourceId: postId,
        originalContent: body.postContent,
        authorLinkedIn: authorLinkedInUrl,
        authorName: authorName,
        applyEmail: extracted.contactEmail,
        applyUrl: extracted.applyUrl,
        enrichmentStatus: 'COMPLETED',
        qualityScore: calculateQualityScore(extracted),
        postedAt: new Date(),
      },
    });

    console.log(`[LinkedInPosts] Created job: ${job.slug}`);

    // Queue company for enrichment
    if (extracted.contactEmail) {
      queueCompanyEnrichment(company.id, extracted.contactEmail);
    }

    // Notify search engines
    try {
      await notifySearchEngines([buildJobUrl(company.slug, job.slug)]);
    } catch (indexError) {
      console.error('[LinkedInPosts] Search engine notification failed:', indexError);
    }

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

  if (company) return company;

  company = await prisma.company.create({
    data: {
      slug: await generateUniqueSlug(slug, 'company'),
      name: normalizedName,
      linkedinUrl: data.linkedinUrl,
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
  if (loc.includes('us only') || loc.includes('usa only')) return 'REMOTE_US';
  if (loc.includes('eu only') || loc.includes('europe only')) return 'REMOTE_EU';
  if (location && location.toLowerCase() !== 'remote' && location.toLowerCase() !== 'worldwide') return 'REMOTE_COUNTRY';

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
