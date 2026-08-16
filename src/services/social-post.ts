import { prisma } from '@/lib/db';
import OpenAI from 'openai';

// AI Provider configuration (same as deepseek.ts)
type AIProvider = 'deepseek' | 'zai';

function getAIProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER?.toLowerCase();
  if (provider === 'zai') return 'zai';
  return 'deepseek';
}

// Lazy initialization
let _deepseek: OpenAI | null = null;
let _zai: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
  return _deepseek;
}

function getZaiClient(): OpenAI {
  if (!_zai) {
    _zai = new OpenAI({
      apiKey: process.env.ZAI_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.z.ai/api/paas/v4',
    });
  }
  return _zai;
}

function getAIClient(): { client: OpenAI; model: string; provider: AIProvider } {
  const provider = getAIProvider();
  if (provider === 'zai') {
    return {
      client: getZaiClient(),
      model: 'glm-4-32b-0414-128k',
      provider: 'zai',
    };
  }
  return {
    client: getDeepSeekClient(),
    model: 'deepseek-chat',
    provider: 'deepseek',
  };
}

const SOCIAL_POST_PROMPT = `You are a social media copywriter for a freelance platform. Create an URGENT post for a direct freelance project.

Generate this format:
🔥 URGENT: [1 sentence why this is hot - client ready to hire NOW]

📍 [Location/Remote]
💰 [Budget if available, skip if yearly salary]

[2-3 sentences: what the client needs, key skills required, why act fast. End with "Apply now!" or similar urgency]

Rules:
- URGENCY is key - emphasize speed, "client needs NOW", "hiring immediately"
- Maximum 300 characters for summary
- Be specific about skills needed
- No hashtags, no links
- Professional but urgent tone
- Skip 💰 line if no budget or if it's yearly salary (not freelance rate)
- Do NOT include "Direct contact" line - it will be added automatically
- Write in the same language as the original post

CRITICAL: Return ONLY the formatted post text. Do NOT include any explanations, apologies, or meta-commentary.`;

/**
 * Detect if AI response contains refusal patterns or meta-commentary
 */
function isValidPostContent(text: string): boolean {
  const refusalPatterns = [
    /^I cannot/i,
    /^I'm unable/i,
    /^I apologize/i,
    /^Sorry,?\s/i,
    /^Unfortunately/i,
    /the instructions require/i,
    /I can't provide/i,
    /I'm not able/i,
    /as an AI/i,
    /I don't have/i,
    /I need to/i,
    /the original post is/i,
    /the request asks/i,
  ];

  for (const pattern of refusalPatterns) {
    if (pattern.test(text)) {
      return false;
    }
  }

  // Valid posts should start with emoji or reasonable content, not meta-text
  // Also reject if it's too long (likely contains explanations)
  if (text.length > 1000) {
    return false;
  }

  return true;
}

interface OpportunityForSocialPost {
  id: string;
  title: string;
  description: string;
  originalContent: string | null;
  location: string | null;
  country: string | null;
  locationType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string;
  level: string;
  type: string;
  skills: string[];
  clientName: string;
  slug: string;
}

/**
 * Generate social media post text using AI (DeepSeek or Z.ai based on AI_PROVIDER)
 */
export async function generateSocialPost(opp: OpportunityForSocialPost): Promise<string> {
  try {
    const { client, model, provider } = getAIClient();
    const providerName = provider === 'zai' ? 'Z.ai' : 'DeepSeek';

    // Build context for AI
    const oppContext = `
Project Title: ${opp.title}
Client: ${opp.clientName}
Location: ${opp.location || 'Remote'}
Location Type: ${opp.locationType}
Country: ${opp.country || 'Worldwide'}
Level: ${opp.level}
Type: Freelance Project
${opp.salaryMin ? `Budget: ${opp.salaryCurrency || 'USD'} ${opp.salaryMin}${opp.salaryMax ? `-${opp.salaryMax}` : ''}/${opp.salaryPeriod?.toLowerCase() || 'project'}` : 'Budget: To be discussed'}
Skills needed: ${opp.skills.join(', ') || 'Various'}

Original post:
${opp.originalContent || opp.description}
`.trim();

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SOCIAL_POST_PROMPT },
        { role: 'user', content: oppContext }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const postText = response.choices[0]?.message?.content?.trim();

    console.log(`[SocialPost] ${providerName} response received, length: ${postText?.length || 0}`);

    if (!postText) {
      console.log(`[SocialPost] ${providerName} returned empty, using fallback`);
      return generateFallbackPost(opp);
    }

    // Validate that AI returned actual post content, not refusal/meta-commentary
    if (!isValidPostContent(postText)) {
      console.log(`[SocialPost] ${providerName} returned invalid content (refusal/meta), using fallback`);
      console.log(`[SocialPost] Invalid content preview: ${postText.substring(0, 200)}...`);
      return generateFallbackPost(opp);
    }

    console.log(`[SocialPost] ${providerName} generated post: ${postText.substring(0, 150)}...`);
    return postText;
  } catch (error) {
    const provider = getAIProvider();
    console.error(`[SocialPost] ${provider} generation error:`, error);
    return generateFallbackPost(opp);
  }
}

/**
 * Escape special characters for Telegram MarkdownV2
 * Characters that need escaping: _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
function escapeTelegramMarkdown(text: string): string {
  // Replace underscores with spaces (common in REMOTE_COUNTRY, job titles)
  // Also escape other problematic characters
  return text
    .replace(/_/g, ' ')  // Replace underscores with spaces
    .replace(/\*/g, '')  // Remove asterisks
    .replace(/`/g, "'")  // Replace backticks with quotes
    .replace(/\[/g, '(') // Replace brackets
    .replace(/\]/g, ')')
    .replace(/~/g, '-'); // Replace tilde
}

/**
 * Fallback post generation without AI
 * Emphasizes urgency (direct contact line added by n8n template)
 */
function generateFallbackPost(opp: OpportunityForSocialPost): string {
  const lines: string[] = [];

  // Urgent header
  lines.push('🔥 URGENT: Client hiring NOW!');
  lines.push('');

  // Location
  const location = opp.location || 'Remote';
  lines.push(`📍 ${location}${opp.country ? `, ${opp.country}` : ''}`);

  // Budget - only show if hourly/daily/project rate, not yearly salary
  if (opp.salaryMin && opp.salaryPeriod !== 'YEAR') {
    const currency = opp.salaryCurrency || 'USD';
    const period = opp.salaryPeriod?.toLowerCase() || 'project';
    const salaryStr = opp.salaryMax
      ? `${currency} ${opp.salaryMin.toLocaleString()}-${opp.salaryMax.toLocaleString()}/${period}`
      : `${currency} ${opp.salaryMin.toLocaleString()}/${period}`;
    lines.push(`💰 ${salaryStr}`);
  }

  lines.push('');

  // Skills needed
  if (opp.skills.length > 0) {
    lines.push(`Looking for ${opp.level.toLowerCase()} freelancer with ${opp.skills.slice(0, 3).join(', ')}. Apply now!`);
  } else {
    lines.push(`${opp.level} freelance project. Client ready to start immediately!`);
  }

  return lines.join('\n');
}

/**
 * Add opportunity to social post queue
 */
export async function addToSocialQueue(opportunityId: string): Promise<void> {
  try {
    // Check if already in queue
    const existing = await prisma.socialPostQueue.findFirst({
      where: { opportunityId }
    });

    if (existing) {
      console.log(`[SocialPost] Opportunity ${opportunityId} already in queue`);
      return;
    }

    await prisma.socialPostQueue.create({
      data: {
        opportunityId,
        status: 'PENDING',
      }
    });

    console.log(`[SocialPost] Added opportunity ${opportunityId} to queue`);
  } catch (error) {
    console.error('[SocialPost] Failed to add to queue:', error);
  }
}

/**
 * Process next item in queue and post to n8n webhook
 * Now works with opportunities (freelance projects) only
 */
export async function processNextSocialPost(): Promise<{ posted: boolean; opportunityId?: string; error?: string }> {
  // Get next pending item (FIFO)
  const next = await prisma.socialPostQueue.findFirst({
    where: {
      status: 'PENDING',
      opportunityId: { not: null }
    },
    orderBy: { createdAt: 'asc' },
    include: {
      opportunity: true
    }
  });

  if (!next || !next.opportunity) {
    return { posted: false, error: 'Queue is empty' };
  }

  const opp = next.opportunity;
  const opportunityId = opp.id;

  try {
    // Generate post text if not cached or if cached content is invalid
    let postText = next.postText;
    if (!postText || !isValidPostContent(postText)) {
      if (postText && !isValidPostContent(postText)) {
        console.log(`[SocialPost] Cached content for ${opportunityId} was invalid, regenerating`);
      }
      postText = await generateSocialPost({
        id: opp.id,
        title: opp.title,
        description: opp.description,
        originalContent: opp.originalContent,
        location: opp.location,
        country: opp.country,
        locationType: opp.locationType,
        salaryMin: opp.salaryMin,
        salaryMax: opp.salaryMax,
        salaryCurrency: opp.salaryCurrency,
        salaryPeriod: opp.salaryPeriod,
        level: opp.level,
        type: opp.type,
        skills: opp.skills,
        clientName: opp.clientName,
        slug: opp.slug,
      });

      // Cache the generated text
      await prisma.socialPostQueue.update({
        where: { id: next.id },
        data: { postText }
      });
    }

    // Build freelanly URL for opportunities with UTM tracking
    const freelanlyUrl = `https://freelanly.com/freelance/${opp.slug}?utm_source=social&utm_medium=linkedin&utm_content=${opp.id}`;

    console.log(`[SocialPost] Preparing to send opportunity ${opportunityId}:`);
    console.log(`[SocialPost] - Title: ${opp.title}`);
    console.log(`[SocialPost] - Client: ${opp.clientName}`);
    console.log(`[SocialPost] - URL: ${freelanlyUrl}`);
    console.log(`[SocialPost] - PostText preview: ${postText?.substring(0, 100)}...`);

    // Send to n8n webhook
    const n8nWebhookUrl = process.env.N8N_SOCIAL_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      throw new Error('N8N_SOCIAL_WEBHOOK_URL not configured');
    }

    const payload = {
      workType: opp.title,
      postContent: postText,
      freelanlyUrl,
      languages: opp.skills.slice(0, 5),
      opportunityId: opp.id,
      clientName: opp.clientName,
      isFreelance: true,
    };

    console.log(`[SocialPost] Sending payload to n8n:`, JSON.stringify(payload, null, 2));

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`n8n webhook failed: ${response.status} ${response.statusText}`);
    }

    // Mark as posted
    await prisma.socialPostQueue.update({
      where: { id: next.id },
      data: {
        status: 'POSTED',
        postedAt: new Date(),
      }
    });

    console.log(`[SocialPost] Posted opportunity ${opportunityId}: ${opp.title}`);
    return { posted: true, opportunityId };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SocialPost] Failed to post opportunity ${opportunityId}:`, errorMessage);

    // Mark as failed
    await prisma.socialPostQueue.update({
      where: { id: next.id },
      data: {
        status: 'FAILED',
        error: errorMessage,
      }
    });

    return { posted: false, opportunityId, error: errorMessage };
  }
}

/**
 * Get queue stats
 */
export async function getSocialQueueStats(): Promise<{
  pending: number;
  posted: number;
  failed: number;
}> {
  const [pending, posted, failed] = await Promise.all([
    prisma.socialPostQueue.count({ where: { status: 'PENDING' } }),
    prisma.socialPostQueue.count({ where: { status: 'POSTED' } }),
    prisma.socialPostQueue.count({ where: { status: 'FAILED' } }),
  ]);

  return { pending, posted, failed };
}

/**
 * Get next post from queue and generate content
 * Returns data for n8n to post, or null if queue is empty
 * Now works with opportunities (freelance projects) only
 */
export async function getNextSocialPost(): Promise<{
  queueItemId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  postContent: string;
  freelanlyUrl: string;
  skills: string[];
  isFreelance: boolean;
} | null> {
  // Get next pending opportunity (FIFO)
  const next = await prisma.socialPostQueue.findFirst({
    where: {
      status: 'PENDING',
      opportunityId: { not: null }
    },
    orderBy: { createdAt: 'asc' },
    include: {
      opportunity: true
    }
  });

  if (!next || !next.opportunity) {
    return null;
  }

  const opp = next.opportunity;

  // Generate post text if not cached or if cached content is invalid
  let postText = next.postText;
  if (!postText || !isValidPostContent(postText)) {
    if (postText && !isValidPostContent(postText)) {
      console.log(`[SocialPost] Cached content for ${opp.id} was invalid in getNextSocialPost, regenerating`);
    }
    postText = await generateSocialPost({
      id: opp.id,
      title: opp.title,
      description: opp.description,
      originalContent: opp.originalContent,
      location: opp.location,
      country: opp.country,
      locationType: opp.locationType,
      salaryMin: opp.salaryMin,
      salaryMax: opp.salaryMax,
      salaryCurrency: opp.salaryCurrency,
      salaryPeriod: opp.salaryPeriod,
      level: opp.level,
      type: opp.type,
      skills: opp.skills,
      clientName: opp.clientName,
      slug: opp.slug,
    });

    // Cache the generated text
    await prisma.socialPostQueue.update({
      where: { id: next.id },
      data: { postText }
    });
  }

  // URL for freelance opportunities with UTM tracking
  const freelanlyUrl = `https://freelanly.com/freelance/${opp.slug}?utm_source=social&utm_medium=telegram&utm_content=${opp.id}`;

  // Sanitize post content for Telegram markdown compatibility
  const sanitizedContent = escapeTelegramMarkdown(postText);

  return {
    queueItemId: next.id,
    jobId: opp.id, // Keep as jobId for backwards compatibility with n8n
    jobTitle: escapeTelegramMarkdown(opp.title),
    companyName: escapeTelegramMarkdown(opp.clientName), // Client name instead of company
    postContent: sanitizedContent,
    freelanlyUrl,
    skills: opp.skills.slice(0, 5).map(s => escapeTelegramMarkdown(s)),
    isFreelance: true,
  };
}

/**
 * Mark queue item as posted
 */
export async function markAsPosted(queueItemId: string, linkedinPostUrn?: string): Promise<void> {
  await prisma.socialPostQueue.update({
    where: { id: queueItemId },
    data: {
      status: 'POSTED',
      postedAt: new Date(),
      ...(linkedinPostUrn ? { linkedinPostUrn } : {}),
    }
  });
  console.log(`[SocialPost] Marked ${queueItemId} as posted${linkedinPostUrn ? ` (LinkedIn: ${linkedinPostUrn})` : ''}`);
}

/**
 * Mark queue item as failed
 */
export async function markAsFailed(queueItemId: string, error: string): Promise<void> {
  await prisma.socialPostQueue.update({
    where: { id: queueItemId },
    data: {
      status: 'FAILED',
      error,
    }
  });
  console.log(`[SocialPost] Marked ${queueItemId} as failed: ${error}`);
}

/**
 * Refill social queue with OPPORTUNITIES (freelance projects) only
 * Called automatically when queue is running low
 */
export async function refillSocialQueue(options: {
  minQueueSize?: number;  // Refill when pending < this (default: 5)
  refillCount?: number;   // How many to add (default: 20)
  maxAgeDays?: number;    // Only opportunities newer than this (default: 14)
} = {}): Promise<{ added: number; skipped: number }> {
  const {
    minQueueSize = 5,
    refillCount = 20,
    maxAgeDays = 14,
  } = options;

  // Check current queue size (only opportunities)
  const pendingCount = await prisma.socialPostQueue.count({
    where: {
      status: 'PENDING',
      opportunityId: { not: null }
    }
  });

  if (pendingCount >= minQueueSize) {
    console.log(`[SocialQueue] Queue has ${pendingCount} pending opportunities, no refill needed`);
    return { added: 0, skipped: 0 };
  }

  const toAdd = refillCount - pendingCount;
  console.log(`[SocialQueue] Queue low (${pendingCount}), adding up to ${toAdd} opportunities`);

  // Get all opportunity IDs already in queue (any status)
  const existingInQueue = await prisma.socialPostQueue.findMany({
    where: { opportunityId: { not: null } },
    select: { opportunityId: true }
  });
  const queuedOppIds = new Set(existingInQueue.map(q => q.opportunityId));

  // Find opportunities to add:
  // - Active
  // - Created within maxAgeDays
  // - Not already in queue
  // - Order by createdAt DESC (newest first)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  const candidates = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      createdAt: { gte: cutoffDate },
    },
    orderBy: { createdAt: 'desc' },
    take: toAdd * 2, // Get more than needed to filter
    select: { id: true, title: true, clientName: true, createdAt: true }
  });

  let added = 0;
  let skipped = 0;

  for (const opp of candidates) {
    if (added >= toAdd) break;

    if (queuedOppIds.has(opp.id)) {
      skipped++;
      continue;
    }

    await prisma.socialPostQueue.create({
      data: {
        opportunityId: opp.id,
        status: 'PENDING',
      }
    });

    console.log(`[SocialQueue] Added opportunity: ${opp.title} (${opp.clientName})`);
    added++;
  }

  console.log(`[SocialQueue] Refill complete: added ${added}, skipped ${skipped} (already in queue)`);
  return { added, skipped };
}

/**
 * Cleanup old posted items from queue
 * Allows jobs to be re-posted after some time
 */
export async function cleanupOldPostedItems(olderThanDays: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.socialPostQueue.deleteMany({
    where: {
      status: 'POSTED',
      postedAt: { lt: cutoffDate },
    },
  });

  if (result.count > 0) {
    console.log(`[SocialQueue] Cleaned up ${result.count} old posted items`);
  }

  return result.count;
}
