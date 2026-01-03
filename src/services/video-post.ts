import { prisma } from '@/lib/db';

/**
 * Video Post Queue Service
 * Manages video content generation queue for social media
 */

// Video backgrounds for Pexels search
const SCENE_VIDEOS = {
  tech: 'code on computer screen programming',
  design: 'design software interface screen',
  professional: 'laptop desk workspace minimal aesthetic',
};

/**
 * Generate video script for a job (same logic as /api/content/video-script)
 */
function generateVideoScript(job: {
  title: string;
  company: { name: string; slug: string };
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryPeriod: string;
  location: string | null;
  type: string;
  slug: string;
}) {
  // Select background based on job type
  const isTech = /developer|engineer|programmer|devops|sre|architect/i.test(job.title);
  const isDesign = /designer|ux|ui|creative/i.test(job.title);
  const background = isTech ? SCENE_VIDEOS.tech : isDesign ? SCENE_VIDEOS.design : SCENE_VIDEOS.professional;

  // Format salary for TTS and captions
  let salaryTTS = '';
  let salaryCaption = '';
  if (job.salaryMin) {
    const salaryK = Math.round((job.salaryMax || job.salaryMin) / 1000);
    salaryTTS = `${salaryK} thousand dollars per year.`;
    salaryCaption = `$${salaryK}K/year.`;
  } else {
    const jobType = job.type.replace('_', ' ').toLowerCase();
    salaryTTS = `${jobType} position.`;
    salaryCaption = `${jobType} position.`;
  }

  const location = job.location || 'Remote';

  // TTS text (phonetic for correct pronunciation)
  const ttsText = `Hot job alert! ${job.company.name} is hiring a ${job.title}. ${salaryTTS} ${location}. Apply now at freelan-lee dot com!`;

  // Caption text (correct spelling for subtitles)
  const captionText = `Hot job alert! ${job.company.name} is hiring a ${job.title}. ${salaryCaption} ${location}. Apply now at freelanly.com!`;

  const jobUrl = `https://freelanly.com/company/${job.company.slug}/jobs/${job.slug}`;

  return {
    scenes: [{
      text: ttsText,
      caption: captionText,
      searchTerms: [background, 'typing keyboard fast technology'],
    }],
    config: {
      voice: 'af_heart',
      music: 'hopeful',
      captionPosition: 'bottom',
      orientation: 'portrait',
      musicVolume: 'low',
    },
    jobUrl,
    // Social media caption (for TG/LI post text)
    socialCaption: `🎬 ${job.title} at ${job.company.name}\n${salaryCaption} ${location}\n\n#remotework #remotejobs #hiring`,
  };
}

/**
 * Get queue stats
 */
export async function getVideoQueueStats(): Promise<{
  pending: number;
  posted: number;
  failed: number;
}> {
  const [pending, posted, failed] = await Promise.all([
    prisma.videoPostQueue.count({ where: { status: 'PENDING' } }),
    prisma.videoPostQueue.count({ where: { status: 'POSTED' } }),
    prisma.videoPostQueue.count({ where: { status: 'FAILED' } }),
  ]);

  return { pending, posted, failed };
}

/**
 * Get next video post from queue
 * Returns data for n8n to create video and post
 */
export async function getNextVideoPost(): Promise<{
  queueItemId: string;
  jobId: string;
  scenes: Array<{ text: string; caption: string; searchTerms: string[] }>;
  config: {
    voice: string;
    music: string;
    captionPosition: string;
    orientation: string;
    musicVolume: string;
  };
  jobUrl: string;
  socialCaption: string;
} | null> {
  // Get next pending item (FIFO)
  const next = await prisma.videoPostQueue.findFirst({
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

  // Generate video script
  const script = generateVideoScript({
    title: job.title,
    company: job.company,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    salaryPeriod: job.salaryPeriod,
    location: job.location,
    type: job.type,
    slug: job.slug,
  });

  return {
    queueItemId: next.id,
    jobId: job.id,
    scenes: script.scenes,
    config: script.config,
    jobUrl: script.jobUrl,
    socialCaption: script.socialCaption,
  };
}

/**
 * Mark queue item as posted
 */
export async function markVideoAsPosted(queueItemId: string, videoId?: string, videoUrl?: string): Promise<void> {
  await prisma.videoPostQueue.update({
    where: { id: queueItemId },
    data: {
      status: 'POSTED',
      postedAt: new Date(),
      videoId,
      videoUrl,
    }
  });
  console.log(`[VideoPost] Marked ${queueItemId} as posted`);
}

/**
 * Mark queue item as failed
 */
export async function markVideoAsFailed(queueItemId: string, error: string): Promise<void> {
  await prisma.videoPostQueue.update({
    where: { id: queueItemId },
    data: {
      status: 'FAILED',
      error,
    }
  });
  console.log(`[VideoPost] Marked ${queueItemId} as failed: ${error}`);
}

/**
 * Refill video queue with new jobs
 * Only jobs with USD salary (looks better in videos)
 */
export async function refillVideoQueue(options: {
  minQueueSize?: number;
  refillCount?: number;
  maxAgeDays?: number;
} = {}): Promise<{ added: number; skipped: number }> {
  const {
    minQueueSize = 5,
    refillCount = 20,
    maxAgeDays = 7,
  } = options;

  // Check current queue size
  const pendingCount = await prisma.videoPostQueue.count({
    where: { status: 'PENDING' }
  });

  if (pendingCount >= minQueueSize) {
    console.log(`[VideoQueue] Queue has ${pendingCount} pending, no refill needed`);
    return { added: 0, skipped: 0 };
  }

  const toAdd = refillCount - pendingCount;
  console.log(`[VideoQueue] Queue low (${pendingCount}), adding up to ${toAdd} jobs`);

  // Get all job IDs already in queue (any status)
  const existingInQueue = await prisma.videoPostQueue.findMany({
    select: { jobId: true }
  });
  const queuedJobIds = new Set(existingInQueue.map(q => q.jobId));

  // Find jobs with salary (looks better in videos)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  const candidates = await prisma.job.findMany({
    where: {
      salaryMin: { not: null },
      salaryCurrency: 'USD',
      salaryPeriod: 'YEAR',
      createdAt: { gte: cutoffDate },
    },
    orderBy: { createdAt: 'desc' },
    take: toAdd * 2,
    select: { id: true, title: true }
  });

  let added = 0;
  let skipped = 0;

  for (const job of candidates) {
    if (added >= toAdd) break;

    if (queuedJobIds.has(job.id)) {
      skipped++;
      continue;
    }

    await prisma.videoPostQueue.create({
      data: {
        jobId: job.id,
        status: 'PENDING',
      }
    });

    console.log(`[VideoQueue] Added: ${job.title}`);
    added++;
  }

  console.log(`[VideoQueue] Refill complete: added ${added}, skipped ${skipped}`);
  return { added, skipped };
}

/**
 * Cleanup old posted items (allows re-posting after some time)
 */
export async function cleanupOldVideoItems(olderThanDays: number = 7): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.videoPostQueue.deleteMany({
    where: {
      status: 'POSTED',
      postedAt: { lt: cutoffDate },
    },
  });

  if (result.count > 0) {
    console.log(`[VideoQueue] Cleaned up ${result.count} old posted items`);
  }

  return result.count;
}
