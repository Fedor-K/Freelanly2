import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { extractJobData, classifyJobCategory, isJobPosting, detectCountry, type ExtractedJobData } from '@/lib/ai';
import { slugify, extractDomainFromEmail, cleanEmail } from '@/lib/utils';
import { ensureSalaryData } from '@/lib/salary-estimation';
import { notifySearchEngines } from '@/lib/indexing';
import { shouldSkipJob } from '@/lib/job-filter';
import { isBlockedApplyEmail } from '@/config/blocked-apply-domains';
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
 * - runId: KeywordRun ID for tracking (from /api/linkedin/next-keyword)
 * - keyword: Search keyword used (fallback if runId not provided)
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

  if (webhookSecret) {
    if (!secret) {
      console.error('[LinkedInPosts] Missing webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const secretBuf = Buffer.from(webhookSecret);
    const providedBuf = Buffer.from(secret);
    const isValid =
      secretBuf.length === providedBuf.length &&
      require('crypto').timingSafeEqual(secretBuf, providedBuf);
    if (!isValid) {
      console.error('[LinkedInPosts] Invalid webhook secret');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Get keyword tracking params
  const runId = request.nextUrl.searchParams.get('runId');
  const keywordParam = request.nextUrl.searchParams.get('keyword');

  try {
    const body: N8nPostPayload = await request.json();

    // Find or create KeywordRun for tracking
    let keywordRunId: string | null = null;
    let sourceKeyword: string | null = null;

    if (runId) {
      // Use provided runId
      const keywordRun = await prisma.keywordRun.findUnique({ where: { id: runId } });
      if (keywordRun) {
        keywordRunId = keywordRun.id;
        sourceKeyword = keywordRun.keyword;
        // Increment postsReceived
        await prisma.keywordRun.update({
          where: { id: runId },
          data: { postsReceived: { increment: 1 } },
        });
      }
    } else if (keywordParam) {
      // Find or create by keyword
      sourceKeyword = keywordParam;
      // Find recent run with this keyword (last 30 min)
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      let keywordRun = await prisma.keywordRun.findFirst({
        where: {
          keyword: keywordParam,
          startedAt: { gte: thirtyMinutesAgo },
        },
        orderBy: { startedAt: 'desc' },
      });

      if (!keywordRun) {
        // Create new run for this keyword
        keywordRun = await prisma.keywordRun.create({
          data: {
            keyword: keywordParam,
            keywordIndex: -1, // Unknown index when created from webhook
            status: 'STARTED',
            postsReceived: 1,
          },
        });
        console.log(`[LinkedInPosts] Created KeywordRun for "${keywordParam}"`);
      } else {
        await prisma.keywordRun.update({
          where: { id: keywordRun.id },
          data: { postsReceived: { increment: 1 } },
        });
      }
      keywordRunId = keywordRun.id;
    }

    // Normalize fields - support both n8n mapped and raw Apify formats
    const postUrl = body.postUrl || body.linkedinUrl;
    const postContent = body.postContent || body.content;

    // Client/Author info (the key data for Opportunities)
    const clientLinkedIn = body['author.linkedinUrl'] || body.authorLinkedinUrl || body.author?.linkedinUrl;
    const clientName = body['author.name'] || body.authorName || body.author?.name || 'Unknown';
    const clientHeadline = body['author.info'] || body.authorInfo || body.author?.info || null;
    const clientType = body['author.type'] || body.authorType || body.author?.type || 'profile';
    const clientAvatar = body['author.avatar.url'] || body.authorAvatarUrl || body.author?.avatar?.url || null;

    // Fire-and-forget skip logging — lets us see WHAT/why posts get rejected at import.
    // Stores enough to JUDGE the call later: reason, title (when known), a short content
    // excerpt, the post URL (open the original) and author. Excerpt capped at 280 chars so
    // ActivityLog stays small. `extra` carries reason-specific fields (e.g. aiReason).
    // Never awaited; must never slow or break the n8n flow.
    const logSkip = (reason: string, title?: string | null, extra?: Record<string, unknown>) => {
      prisma.activityLog.create({
        data: {
          action: 'IMPORT_SKIP',
          details: {
            source: 'linkedin',
            reason,
            title: title || null,
            excerpt: typeof postContent === 'string' ? postContent.slice(0, 280) : null,
            postUrl: postUrl || null,
            author: clientName || null,
            ...extra,
          },
        },
      }).catch(() => {});
    };

    // Validate required fields - return 200 OK but skip if empty (don't break n8n flow)
    if (!postUrl || !postContent) {
      console.log('[LinkedInPosts] Skipping post with empty data');
      logSkip('empty_data');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'empty_data',
      });
    }

    if (!clientLinkedIn) {
      console.log('[LinkedInPosts] Skipping post without author LinkedIn URL');
      logSkip('no_client_linkedin');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'no_client_linkedin',
      });
    }

    console.log(`[LinkedInPosts] Processing post from ${clientName}: ${postUrl}`);

    // =========================================================================
    // SKIP OWN PLATFORM POSTS - Freelanly's LinkedIn posts should not be imported
    // =========================================================================
    const FREELANLY_LINKEDIN_PATTERNS = [
      'professional-community-of-freelance-translators-and-interpreters',
    ];

    if (
      clientName?.toLowerCase().startsWith('freelanly') ||
      FREELANLY_LINKEDIN_PATTERNS.some(pattern => clientLinkedIn?.includes(pattern))
    ) {
      console.log(`[LinkedInPosts] Skipping Freelanly own post: ${postUrl}`);
      logSkip('own_platform');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'own_platform',
      });
    }

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
      logSkip('duplicate');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'duplicate',
      });
    }

    // =========================================================================
    // KEYWORD PRE-FILTER: Catch obvious self-promotion before calling AI
    // =========================================================================
    const contentLower = postContent.toLowerCase();
    const selfPromoPatterns = [
      /\bi am a\s+(freelance|translator|copywriter|designer|developer|writer|editor|consultant)/,
      /\bi'?m a\s+(freelance|translator|copywriter|designer|developer|writer|editor|consultant)/,
      /\bi offer\s+(my\s+)?services/,
      /\bmy services include/,
      /\bhire me\b/,
      /\bi'?m available for\s+(projects|work|freelance)/,
      /\blooking for\s+(new\s+)?clients/,
      /\bneed a\b.{0,30}\?\s*(then\s+)?(hit me up|reach out|contact me|send me|let'?s connect|dm me|get in touch)/i,
      /\bbook a\s+(free\s+)?(call|consultation|session)\b/,
      /\bcheck out my\s+(portfolio|website|work)\b/,
    ];

    const selfPromoMatch = selfPromoPatterns.find(pattern => pattern.test(contentLower));
    if (selfPromoMatch) {
      console.log(`[LinkedInPosts] Self-promotion detected by keyword filter: ${selfPromoMatch}`);
      logSkip('self_promo');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'not_job_posting',
        details: 'Self-promotion detected by keyword filter',
      });
    }

    // =========================================================================
    // AI VALIDATION: Check if post is actually a job posting (not event/announcement)
    // =========================================================================
    console.log(`[LinkedInPosts] Validating post type...`);
    const validationResult = await isJobPosting(postContent);

    if (!validationResult.isJob) {
      console.log(`[LinkedInPosts] Not a job posting: ${validationResult.reason}`);
      // Capture the AI's SPECIFIC reason (e.g. "looks like a webinar invite", "candidate seeking work",
      // "vague — no specific role") so a histogram on details->>'aiReason' tells us whether the filter
      // is rejecting real noise or grey-zone jobs. logSkip also stores the excerpt + post URL, so we
      // can read the actual post the AI rejected and judge whether the call was right.
      logSkip('not_job_posting', null, { aiReason: validationResult.reason });
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'not_job_posting',
        details: validationResult.reason,
      });
    }

    // Increment postsProcessed (passed isJobPosting validation)
    if (keywordRunId) {
      await prisma.keywordRun.update({
        where: { id: keywordRunId },
        data: { postsProcessed: { increment: 1 } },
      });
    }

    // Extract job data using Z.ai
    console.log(`[LinkedInPosts] Extracting data from post...`);
    const extracted = await extractJobData(postContent);

    if (!extracted || !extracted.title) {
      console.log(`[LinkedInPosts] Could not extract job title`);
      logSkip('no_title');
      return NextResponse.json({
        success: true,
        status: 'skipped',
        reason: 'no_title',
      });
    }

    // Clean and validate email (handles AI-extracted emails with extra text)
    const validatedEmail = cleanEmail(extracted.contactEmail);

    // Hard block: refuse posts whose apply email is on the global blocklist.
    if (isBlockedApplyEmail(validatedEmail)) {
      console.log(`[LinkedInPosts] Blocked apply domain: ${validatedEmail}`);
      logSkip('blocked_domain', extracted.title);
      return NextResponse.json({ success: true, status: 'skipped', reason: 'blocked_domain' });
    }

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
      logSkip(filterResult.reason || 'profession_filter', extracted.title);
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
      logSkip('duplicate_title', extracted.title);
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

    // Generate unique slug for opportunity (title + location/skill, NO client name for privacy)
    const slugParts = [extracted.title];
    if (extracted.location && extracted.location.toLowerCase() !== 'remote') {
      slugParts.push(extracted.location.split(',')[0].trim()); // First part of location
    } else if (extracted.skills?.length > 0) {
      slugParts.push(extracted.skills[0]); // First skill as differentiator
    }
    const baseSlug = slugify(slugParts.join('-'));
    const slug = await generateUniqueOpportunitySlug(baseSlug);

    // Detect country using AI
    const countryCode = await detectCountry(
      extracted.title,
      extracted.cleanDescription || postContent,
      extracted.location
    ) || extractCountryCode(extracted.location); // fallback to dictionary

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
      applyEmail: validatedEmail,
      applyUrl: extracted.applyUrl,
      isFreeEmail: hasFreeEmail,
      isAnnouncement,
      apolloValidated: false, // No Apollo for opportunities
    });

    console.log(`[LinkedInPosts] Content quality: ${qualityResult.quality} (score: ${qualityResult.score})`);

    // =========================================================================
    // CREATE OPPORTUNITY — only if applyEmail exists
    // =========================================================================

    if (!validatedEmail) {
      console.log(`[LinkedInPosts] Skipping — no applyEmail found in post`);
      return NextResponse.json({ status: 'skipped', reason: 'no_email' });
    }

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
          location: countryCode ? countryCodeToName(countryCode) : (extracted.isRemote ? (extracted.location || 'Remote') : extracted.location),
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
          // Keyword tracking
          sourceKeyword: sourceKeyword,
          keywordRunId: keywordRunId,
          contentQuality: qualityResult.quality,
          qualityScore: qualityResult.score,
          postedAt: new Date(),
          // 14-day expiry for opportunities (shorter than jobs)
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });

      // Increment opportunitiesCreated
      if (keywordRunId) {
        await prisma.keywordRun.update({
          where: { id: keywordRunId },
          data: { opportunitiesCreated: { increment: 1 } },
        });
      }
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

    // INSTANT alerts are now handled by pull-model cron (process-instant-alerts)
    // No queue operation needed here

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
      sourceKeyword: sourceKeyword,
      keywordRunId: keywordRunId,
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
  const MAX_ATTEMPTS = 100;
  let slug = base;
  let counter = 1;

  while (counter <= MAX_ATTEMPTS) {
    const exists = await prisma.opportunity.findUnique({ where: { slug } });
    if (!exists) return slug;
    slug = `${base}-${counter}`;
    counter++;
  }

  // Fallback: append random suffix to guarantee uniqueness
  return `${base}-${Date.now()}`;
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
function countryCodeToName(code: string): string {
  const names: Record<string, string> = {
    US: 'United States', GB: 'United Kingdom', CA: 'Canada', DE: 'Germany',
    FR: 'France', NL: 'Netherlands', ES: 'Spain', IT: 'Italy', AU: 'Australia',
    IN: 'India', BR: 'Brazil', MX: 'Mexico', PL: 'Poland', PT: 'Portugal',
    IE: 'Ireland', SE: 'Sweden', CH: 'Switzerland', JP: 'Japan', KR: 'South Korea',
    SG: 'Singapore', AE: 'UAE', SA: 'Saudi Arabia', NG: 'Nigeria', KE: 'Kenya',
    ZA: 'South Africa', PK: 'Pakistan', BD: 'Bangladesh', PH: 'Philippines',
    VN: 'Vietnam', TH: 'Thailand', ID: 'Indonesia', MY: 'Malaysia', EG: 'Egypt',
    AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Peru', RO: 'Romania',
    CZ: 'Czech Republic', HU: 'Hungary', BE: 'Belgium', AT: 'Austria',
    DK: 'Denmark', FI: 'Finland', NO: 'Norway', IL: 'Israel', TR: 'Turkey',
    UA: 'Ukraine', RU: 'Russia', CN: 'China', TW: 'Taiwan', HK: 'Hong Kong',
    NZ: 'New Zealand', GH: 'Ghana', CM: 'Cameroon', CI: 'Ivory Coast',
  };
  return names[code] || code;
}

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
