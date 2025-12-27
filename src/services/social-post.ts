import { prisma } from '@/lib/db';
import OpenAI from 'openai';

// Lazy initialization
let _deepseek: OpenAI | null = null;

function getDeepSeekClient(): OpenAI {
  if (!_deepseek) {
    _deepseek = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || 'dummy-key-for-build',
      baseURL: 'https://api.deepseek.com/v1',
    });
  }
  return _deepseek;
}

const SOCIAL_POST_PROMPT = `You are a social media copywriter for a job board. Create ONLY the body of a job post (title and skills will be added automatically by the system).

IMPORTANT: Keep the language EXACTLY THE SAME as the job description. Russian job = Russian post. English job = English post.

Generate ONLY this format (no title line - it's added automatically):
📍 [Location/Remote status]
💰 [Salary if available, skip if no salary]
🏢 [Company if known, skip if unknown]

[2-3 sentence summary: role description, key requirements, what makes it attractive]

Rules:
- Do NOT include job title (🎯) - it's added automatically
- Maximum 280 characters for summary
- Be specific (e.g., "5+ years React" not "experience required")
- No hashtags, no links
- Professional tone
- Skip 💰 line if no salary
- Skip 🏢 line if company unknown

Return ONLY the formatted body text, nothing else.`;

interface JobForSocialPost {
  id: string;
  title: string;
  description: string;
  cleanDescription: string | null;
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
  company: {
    name: string;
    slug: string;
  };
  slug: string;
}

/**
 * Generate social media post text using DeepSeek
 */
export async function generateSocialPost(job: JobForSocialPost): Promise<string> {
  try {
    const deepseek = getDeepSeekClient();

    // Build context for AI
    const jobContext = `
Job Title: ${job.title}
Company: ${job.company.name}
Location: ${job.location || 'Remote'}
Location Type: ${job.locationType}
Country: ${job.country || 'Worldwide'}
Level: ${job.level}
Type: ${job.type}
${job.salaryMin ? `Salary: ${job.salaryCurrency || 'USD'} ${job.salaryMin}${job.salaryMax ? `-${job.salaryMax}` : ''}/${job.salaryPeriod?.toLowerCase() || 'year'}` : 'Salary: Not specified'}
Skills: ${job.skills.join(', ') || 'Not specified'}

Description:
${job.cleanDescription || job.description}
`.trim();

    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SOCIAL_POST_PROMPT },
        { role: 'user', content: jobContext }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const postText = response.choices[0]?.message?.content?.trim();

    console.log(`[SocialPost] AI response received, length: ${postText?.length || 0}`);

    if (!postText) {
      console.log(`[SocialPost] AI returned empty, using fallback`);
      // Fallback to simple format
      return generateFallbackPost(job);
    }

    console.log(`[SocialPost] AI generated post: ${postText.substring(0, 150)}...`);
    return postText;
  } catch (error) {
    console.error('[SocialPost] AI generation error:', error);
    return generateFallbackPost(job);
  }
}

/**
 * Fallback post generation without AI
 * Note: Does NOT include title (🎯) - n8n template adds it from workType
 */
function generateFallbackPost(job: JobForSocialPost): string {
  const lines: string[] = [];

  // Location
  const location = job.location || (job.locationType === 'REMOTE' ? 'Remote' : 'Remote');
  lines.push(`📍 ${location}${job.country ? `, ${job.country}` : ''}`);

  // Salary
  if (job.salaryMin) {
    const currency = job.salaryCurrency || 'USD';
    const period = job.salaryPeriod?.toLowerCase() || 'year';
    const salaryStr = job.salaryMax
      ? `${currency} ${job.salaryMin.toLocaleString()}-${job.salaryMax.toLocaleString()}/${period}`
      : `${currency} ${job.salaryMin.toLocaleString()}/${period}`;
    lines.push(`💰 ${salaryStr}`);
  }

  // Company
  if (job.company.name) {
    lines.push(`🏢 ${job.company.name}`);
  }

  lines.push('');

  // Simple summary from skills
  if (job.skills.length > 0) {
    lines.push(`Looking for ${job.level.toLowerCase()} professional with ${job.skills.slice(0, 3).join(', ')}.`);
  } else {
    lines.push(`${job.level} ${job.type.replace('_', '-').toLowerCase()} position.`);
  }

  return lines.join('\n');
}

/**
 * Add job to social post queue
 */
export async function addToSocialQueue(jobId: string): Promise<void> {
  try {
    // Check if already in queue
    const existing = await prisma.socialPostQueue.findFirst({
      where: { jobId }
    });

    if (existing) {
      console.log(`[SocialPost] Job ${jobId} already in queue`);
      return;
    }

    await prisma.socialPostQueue.create({
      data: {
        jobId,
        status: 'PENDING',
      }
    });

    console.log(`[SocialPost] Added job ${jobId} to queue`);
  } catch (error) {
    console.error('[SocialPost] Failed to add to queue:', error);
  }
}

/**
 * Process next item in queue and post to n8n webhook
 */
export async function processNextSocialPost(): Promise<{ posted: boolean; jobId?: string; error?: string }> {
  // Get next pending item (FIFO)
  const next = await prisma.socialPostQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      job: {
        include: {
          company: true
        }
      }
    }
  });

  if (!next) {
    return { posted: false, error: 'Queue is empty' };
  }

  const job = next.job;
  const jobId = job.id;

  try {
    // Generate post text if not cached
    let postText = next.postText;
    if (!postText) {
      postText = await generateSocialPost({
        id: job.id,
        title: job.title,
        description: job.description,
        cleanDescription: job.cleanDescription,
        location: job.location,
        country: job.country,
        locationType: job.locationType,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        salaryPeriod: job.salaryPeriod,
        level: job.level,
        type: job.type,
        skills: job.skills,
        company: job.company,
        slug: job.slug,
      });

      // Cache the generated text
      await prisma.socialPostQueue.update({
        where: { id: next.id },
        data: { postText }
      });
    }

    // Build freelanly URL
    const freelanlyUrl = `https://freelanly.com/company/${job.company.slug}/jobs/${job.slug}`;

    console.log(`[SocialPost] Preparing to send job ${jobId}:`);
    console.log(`[SocialPost] - Title: ${job.title}`);
    console.log(`[SocialPost] - Company: ${job.company.name} (slug: ${job.company.slug})`);
    console.log(`[SocialPost] - Job slug: ${job.slug}`);
    console.log(`[SocialPost] - URL: ${freelanlyUrl}`);
    console.log(`[SocialPost] - PostText length: ${postText?.length || 0}`);
    console.log(`[SocialPost] - PostText preview: ${postText?.substring(0, 100)}...`);

    // Send to n8n webhook (n8n template handles CTAs and links)
    const n8nWebhookUrl = process.env.N8N_SOCIAL_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      throw new Error('N8N_SOCIAL_WEBHOOK_URL not configured');
    }

    const payload = {
      workType: job.title,
      postContent: postText,
      freelanlyUrl,
      languages: job.skills.slice(0, 5),
      jobId: job.id,
      companyName: job.company.name,
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

    console.log(`[SocialPost] Posted job ${jobId}: ${job.title}`);
    return { posted: true, jobId };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[SocialPost] Failed to post job ${jobId}:`, errorMessage);

    // Mark as failed
    await prisma.socialPostQueue.update({
      where: { id: next.id },
      data: {
        status: 'FAILED',
        error: errorMessage,
      }
    });

    return { posted: false, jobId, error: errorMessage };
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
 */
export async function getNextSocialPost(): Promise<{
  queueItemId: string;
  jobId: string;
  jobTitle: string;
  companyName: string;
  postContent: string;
  freelanlyUrl: string;
  skills: string[];
} | null> {
  // Get next pending item (FIFO)
  const next = await prisma.socialPostQueue.findFirst({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    include: {
      job: {
        include: {
          company: true
        }
      }
    }
  });

  if (!next || !next.job) {
    return null;
  }

  const job = next.job;

  // Generate post text if not cached
  let postText = next.postText;
  if (!postText) {
    postText = await generateSocialPost({
      id: job.id,
      title: job.title,
      description: job.description,
      cleanDescription: job.cleanDescription,
      location: job.location,
      country: job.country,
      locationType: job.locationType,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      salaryPeriod: job.salaryPeriod,
      level: job.level,
      type: job.type,
      skills: job.skills,
      company: job.company,
      slug: job.slug,
    });

    // Cache the generated text
    await prisma.socialPostQueue.update({
      where: { id: next.id },
      data: { postText }
    });
  }

  const freelanlyUrl = `https://freelanly.com/company/${job.company.slug}/jobs/${job.slug}`;

  return {
    queueItemId: next.id,
    jobId: job.id,
    jobTitle: job.title,
    companyName: job.company.name,
    postContent: postText,
    freelanlyUrl,
    skills: job.skills.slice(0, 5),
  };
}

/**
 * Mark queue item as posted
 */
export async function markAsPosted(queueItemId: string): Promise<void> {
  await prisma.socialPostQueue.update({
    where: { id: queueItemId },
    data: {
      status: 'POSTED',
      postedAt: new Date(),
    }
  });
  console.log(`[SocialPost] Marked ${queueItemId} as posted`);
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
 * Refill social queue with jobs that haven't been posted yet
 * Called automatically when queue is running low
 */
export async function refillSocialQueue(options: {
  minQueueSize?: number;  // Refill when pending < this (default: 5)
  refillCount?: number;   // How many to add (default: 20)
  maxAgeDays?: number;    // Only jobs newer than this (default: 14)
} = {}): Promise<{ added: number; skipped: number }> {
  const {
    minQueueSize = 5,
    refillCount = 20,
    maxAgeDays = 14,
  } = options;

  // Check current queue size
  const pendingCount = await prisma.socialPostQueue.count({
    where: { status: 'PENDING' }
  });

  if (pendingCount >= minQueueSize) {
    console.log(`[SocialQueue] Queue has ${pendingCount} pending, no refill needed`);
    return { added: 0, skipped: 0 };
  }

  const toAdd = refillCount - pendingCount;
  console.log(`[SocialQueue] Queue low (${pendingCount}), adding up to ${toAdd} jobs`);

  // Get all job IDs already in queue (any status)
  const existingInQueue = await prisma.socialPostQueue.findMany({
    select: { jobId: true }
  });
  const queuedJobIds = new Set(existingInQueue.map(q => q.jobId));

  // Find jobs to add:
  // - REMOTE or HYBRID only
  // - Created within maxAgeDays
  // - Not already in queue
  // - Order by createdAt DESC (newest first)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  const candidates = await prisma.job.findMany({
    where: {
      locationType: { in: ['REMOTE', 'HYBRID'] },
      createdAt: { gte: cutoffDate },
    },
    orderBy: { createdAt: 'desc' },
    take: toAdd * 2, // Get more than needed to filter
    select: { id: true, title: true, createdAt: true }
  });

  let added = 0;
  let skipped = 0;

  for (const job of candidates) {
    if (added >= toAdd) break;

    if (queuedJobIds.has(job.id)) {
      skipped++;
      continue;
    }

    await prisma.socialPostQueue.create({
      data: {
        jobId: job.id,
        status: 'PENDING',
      }
    });

    console.log(`[SocialQueue] Added: ${job.title}`);
    added++;
  }

  console.log(`[SocialQueue] Refill complete: added ${added}, skipped ${skipped} (already in queue)`);
  return { added, skipped };
}
