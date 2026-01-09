import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractJobData, classifyJobCategory, isJobPosting, type ExtractedJobData } from '@/lib/deepseek';
import { slugify, extractDomainFromEmail, cleanEmail } from '@/lib/utils';
import { ensureSalaryData } from '@/lib/salary-estimation';
import { notifySearchEngines } from '@/lib/indexing';
import { sendInstantAlertsForOpportunity } from '@/services/alert-notifications';
import { shouldSkipJob } from '@/lib/job-filter';
import { assessContentQuality, isFreeEmailProvider, isPersonalAnnouncement } from '@/lib/content-quality';
import { siteConfig } from '@/config/site';
import type { TranslationType, Level } from '@prisma/client';

// Valid TranslationType enum values from Prisma schema
const VALID_TRANSLATION_TYPES: TranslationType[] = [
  'TRANSLATION', 'INTERPRETATION', 'LOCALIZATION', 'EDITING',
  'TRANSCRIPTION', 'SUBTITLING', 'MT_POST_EDITING', 'COPYWRITING'
];

// Valid Level enum values from Prisma schema
const VALID_LEVELS: Level[] = [
  'INTERN', 'ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'EXECUTIVE'
];

// Filter to only valid translation types (AI sometimes returns invalid values)
function filterValidTranslationTypes(types: string[] | undefined): TranslationType[] {
  if (!types || !Array.isArray(types)) return [];
  return types.filter((t): t is TranslationType =>
    VALID_TRANSLATION_TYPES.includes(t as TranslationType)
  );
}

// Validate level value (AI sometimes returns invalid values like "FREELANCE")
function validateLevel(level: string | null | undefined): Level | null {
  if (!level) return null;
  return VALID_LEVELS.includes(level as Level) ? (level as Level) : null;
}

/**
 * POST /api/webhooks/linkedin-posts
 *
 * Webhook endpoint for receiving LinkedIn posts from n8n workflow.
 * Creates OPPORTUNITIES (not Jobs) - direct client projects from LinkedIn.
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
  authorAvatarUrl?: string;
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

    // Client/Author info (the key data for Opportunities)
    const clientLinkedIn = body['author.linkedinUrl'] || body.authorLinkedinUrl || body.author?.linkedinUrl;
    const clientName = body['author.name'] || body.authorName || body.author?.name || 'Unknown';
    const clientHeadline = body['author.info'] || body.authorInfo || body.author?.info || null;
    const clientType = body['author.type'] || body.authorType || body.author?.type || 'profile';
    const clientAvatar = body['author.avatar.url'] || body.authorAvatarUrl || body.author?.avatar?.url || null;

    // Validate required fields - return 200 OK but skip if empty (don't break n8n flow)
    if (!postUrl || !postContent) {
      console.log('[LinkedInPosts] Skipping post with empty data');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'empty_data',
      });
    }

    if (!clientLinkedIn) {
      console.log('[LinkedInPosts] Skipping post without author LinkedIn URL');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'no_client_linkedin',
      });
    }

    console.log(`[LinkedInPosts] Processing post from ${clientName}: ${postUrl}`);

    // Extract post ID from URL
    const postId = extractPostId(postUrl);

    // Check if already exists in Opportunity table
    const existingOpportunity = await prisma.opportunity.findFirst({
      where: {
        OR: [
          { sourceId: postId },
          { sourceUrl: postUrl },
        ],
      },
    });

    if (existingOpportunity) {
      console.log(`[LinkedInPosts] Duplicate opportunity, skipping: ${postId}`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'duplicate',
      });
    }

    // =========================================================================
    // AI VALIDATION: Check if post is actually a job posting (not event/announcement)
    // =========================================================================
    console.log(`[LinkedInPosts] Validating post type...`);
    const validationResult = await isJobPosting(postContent);

    if (!validationResult.isJob) {
      console.log(`[LinkedInPosts] Not a job posting: ${validationResult.reason}`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'not_job_posting',
        details: validationResult.reason,
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

    // Track quality signals (soft signals, NOT hard filters)
    const isAnnouncement = isPersonalAnnouncement(extracted.title, postContent);
    const hasFreeEmail = isFreeEmailProvider(validatedEmail);

    if (isAnnouncement) {
      console.log(`[LinkedInPosts] Announcement style detected (will affect quality score)`);
    }

    // =========================================================================
    // EARLY FILTERS - before expensive operations
    // =========================================================================

    // Map location type (needed for filter)
    const locationType = mapLocationType(extracted.isRemote, extracted.location);

    // Apply global job filter FIRST (non-target titles, HYBRID/ONSITE)
    const filterResult = shouldSkipJob({
      title: extracted.title,
      location: extracted.location,
      locationType,
    });
    if (filterResult.skip) {
      console.log(`[LinkedInPosts] Filtered out: ${extracted.title} (${filterResult.reason})`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: filterResult.reason,
      });
    }

    // Check for similar opportunity from same client
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const duplicateByClient = await prisma.opportunity.findFirst({
      where: {
        clientLinkedIn: clientLinkedIn,
        title: { equals: extracted.title, mode: 'insensitive' },
        createdAt: { gte: tenDaysAgo },
      },
    });

    if (duplicateByClient) {
      console.log(`[LinkedInPosts] Duplicate opportunity by client+title, skipping`);
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'duplicate_title',
      });
    }

    // =========================================================================
    // CATEGORY & SALARY
    // =========================================================================

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

    // Generate unique slug for opportunity
    const baseSlug = slugify(`${extracted.title}-${clientName}`);
    const slug = await generateUniqueOpportunitySlug(baseSlug);

    // Get country code for salary estimation
    const countryCode = extractCountryCode(extracted.location);

    // Get actual or estimated salary data (default to HOUR for freelance)
    const salaryData = extracted.salaryMin ? {
      salaryMin: extracted.salaryMin,
      salaryMax: extracted.salaryMax,
      salaryCurrency: extracted.salaryCurrency || 'USD',
      salaryPeriod: extracted.salaryPeriod || 'HOUR',
      salaryIsEstimate: false,
    } : ensureSalaryData({ salaryMin: null }, category.slug, extracted.level || 'MID', countryCode);

    // Assess content quality for SEO (THIN = noindex, LIGHT/RICH = index)
    const qualityResult = assessContentQuality({
      description: postContent,
      cleanDescription: extracted.cleanDescription,
      salaryMin: salaryData.salaryMin,
      skills: extracted.skills,
      requirementBullets: extracted.requirementBullets,
      benefitBullets: extracted.benefitBullets,
      applyEmail: validatedEmail,
      applyUrl: extracted.applyUrl,
      isFreeEmail: hasFreeEmail,
      isAnnouncement,
      apolloValidated: false, // No Apollo for opportunities
    });

    console.log(`[LinkedInPosts] Content quality: ${qualityResult.quality} (score: ${qualityResult.score})`);

    // =========================================================================
    // CREATE OPPORTUNITY
    // =========================================================================

    let opportunity;
    try {
      opportunity = await prisma.opportunity.create({
        data: {
          slug,
          // Client info (the key difference from Jobs)
          clientName,
          clientLinkedIn,
          clientType,
          clientHeadline,
          clientAvatar,
          // Original content
          originalContent: postContent,
          // Extracted data
          title: extracted.title,
          description: extracted.cleanDescription || postContent,
          categoryId: category.id,
          location: extracted.isRemote ? (extracted.location || 'Remote') : extracted.location,
          locationType,
          country: countryCode,
          level: validateLevel(extracted.level) || 'MID',
          type: 'FREELANCE', // Always FREELANCE for opportunities
          skills: extracted.skills,
          translationTypes: filterValidTranslationTypes(extracted.translationTypes),
          sourceLanguages: extracted.sourceLanguages || [],
          targetLanguages: extracted.targetLanguages || [],
          ...salaryData,
          applyEmail: validatedEmail,
          applyUrl: extracted.applyUrl,
          sourceUrl: postUrl,
          sourceId: postId,
          contentQuality: qualityResult.quality,
          qualityScore: qualityResult.score,
          postedAt: new Date(),
          // 14-day expiry for opportunities (shorter than jobs)
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
    } catch (createError: unknown) {
      // Handle unique constraint violation (race condition)
      if (
        createError &&
        typeof createError === 'object' &&
        'code' in createError &&
        createError.code === 'P2002'
      ) {
        console.log(`[LinkedInPosts] Duplicate opportunity (unique constraint), skipping: ${extracted.title}`);
        return NextResponse.json({
          success: true,
          status: 'skipped',
          reason: 'duplicate_constraint',
        });
      }
      throw createError;
    }

    console.log(`[LinkedInPosts] Created opportunity: ${opportunity.slug} (quality: ${qualityResult.quality})`);

    // Send INSTANT alerts for this opportunity (non-blocking)
    sendInstantAlertsForOpportunity(opportunity.id).catch((err) => {
      console.error('[LinkedInPosts] Instant alerts failed:', err);
    });

    // Notify search engines - ONLY for non-THIN content
    if (qualityResult.quality !== 'THIN') {
      try {
        const opportunityUrl = `${siteConfig.url}/freelance/${opportunity.slug}`;
        await notifySearchEngines([opportunityUrl], { skipGoogle: qualityResult.quality !== 'RICH' });
      } catch (indexError) {
        console.error('[LinkedInPosts] Search engine notification failed:', indexError);
      }
    }

    return NextResponse.json({
      success: true,
      status: 'created',
      opportunityId: opportunity.id,
      opportunitySlug: opportunity.slug,
      clientName,
      contentQuality: qualityResult.quality,
      qualityScore: qualityResult.score,
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

// Generate unique slug for opportunity
async function generateUniqueOpportunitySlug(base: string): Promise<string> {
  let slug = base;
  let counter = 1;

  while (true) {
    const exists = await prisma.opportunity.findUnique({ where: { slug } });
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

// GET endpoint for testing
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  const webhookSecret = process.env.N8N_WEBHOOK_SECRET || process.env.APIFY_WEBHOOK_SECRET;

  if (webhookSecret && secret !== webhookSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    status: 'ok',
    message: 'LinkedIn Posts webhook endpoint is ready (creates Opportunities)',
    usage: {
      method: 'POST',
      url: '/api/webhooks/linkedin-posts?secret=YOUR_SECRET',
      body: {
        postUrl: 'LinkedIn post URL',
        postContent: 'Post content text',
        'author.linkedinUrl': 'Author LinkedIn URL (required)',
        'author.name': 'Author name',
        'author.info': 'Author headline (optional)',
        'author.type': 'profile or company',
        'author.avatar.url': 'Avatar URL (optional)',
      },
    },
  });
}
