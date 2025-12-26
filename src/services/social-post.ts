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

const SOCIAL_POST_PROMPT = `You are a social media copywriter for a job board. Create a concise, engaging job post for LinkedIn and Telegram.

IMPORTANT: Keep the language of the post EXACTLY THE SAME as the language of the original job description. If the job is in Russian, write in Russian. If in English, write in English.

Format:
🎯 [Job Title]

📍 [Location/Remote status]
💰 [Salary if available, skip line if no salary]
🏢 [Company if known, skip line if no company]

[2-3 sentence summary: what the role is about, key requirements, what makes it attractive. Be specific but concise. Highlight unique aspects.]

Rules:
- Maximum 280 characters for the summary part (not counting emojis)
- Be specific about requirements (e.g., "5+ years React" not "experience required")
- Highlight salary if available (it's a big attractor)
- Mention remote/location clearly
- No hashtags
- No links (link will be added automatically)
- No promotional language like "Amazing opportunity!"
- Professional but engaging tone
- If company is unknown, skip the 🏢 line entirely
- If no salary, skip the 💰 line entirely

Return ONLY the formatted post text, no explanations.`;

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

    if (!postText) {
      // Fallback to simple format
      return generateFallbackPost(job);
    }

    return postText;
  } catch (error) {
    console.error('[SocialPost] AI generation error:', error);
    return generateFallbackPost(job);
  }
}

/**
 * Fallback post generation without AI
 */
function generateFallbackPost(job: JobForSocialPost): string {
  const lines = [`🎯 ${job.title}`];
  lines.push('');

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

    // Send to n8n webhook (n8n template handles CTAs and links)
    const n8nWebhookUrl = process.env.N8N_SOCIAL_WEBHOOK_URL;
    if (!n8nWebhookUrl) {
      throw new Error('N8N_SOCIAL_WEBHOOK_URL not configured');
    }

    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        workType: job.title,
        postContent: postText,
        freelanlyUrl,
        languages: job.skills.slice(0, 5),
        jobId: job.id,
        companyName: job.company.name,
      })
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
