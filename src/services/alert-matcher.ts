import { prisma } from '@/lib/db';
import { AlertFrequency } from '@prisma/client';

interface LanguagePair {
  translationType: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface JobAlert {
  id: string;
  email: string;
  userId: string | null;
  category: string | null;
  keywords: string | null;
  country: string | null;
  level: string | null;
  frequency: AlertFrequency;
  languagePairs: LanguagePair[];
  lastSentAt: Date | null;
}

interface MatchedJob {
  id: string;
  title: string;
  slug: string;
  description: string;
  company: {
    name: string;
    slug: string;
    logo: string | null;
  };
  category: {
    slug: string;
  };
  country: string | null;
  level: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date;
  translationTypes: string[];
  sourceLanguages: string[];
  targetLanguages: string[];
}

export interface AlertWithMatches {
  alert: JobAlert;
  jobs: MatchedJob[];
}

/**
 * Find jobs that match an alert's criteria
 */
async function findMatchingJobs(
  alert: JobAlert,
  since: Date
): Promise<MatchedJob[]> {
  // Build where clause based on alert criteria
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    isActive: true,
    postedAt: {
      gte: since,
    },
    // Exclude jobs already sent to this alert
    NOT: {
      alertNotifications: {
        some: {
          jobAlertId: alert.id,
        },
      },
    },
  };

  // Category filter
  if (alert.category) {
    where.category = {
      slug: alert.category,
    };
  }

  // Country filter
  if (alert.country) {
    where.country = alert.country;
  }

  // Level filter
  if (alert.level) {
    where.level = alert.level;
  }

  // Fetch jobs with company and category
  const jobs = await prisma.job.findMany({
    where,
    include: {
      company: {
        select: {
          name: true,
          slug: true,
          logo: true,
          website: true,
        },
      },
      category: {
        select: {
          slug: true,
        },
      },
    },
    orderBy: {
      postedAt: 'desc',
    },
    take: 50, // Limit to prevent huge emails
  });

  // Filter by keywords (if provided)
  let filteredJobs = jobs;
  if (alert.keywords) {
    const keywordList = alert.keywords
      .toLowerCase()
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k);

    filteredJobs = jobs.filter((job) => {
      const searchText = `${job.title} ${job.description}`.toLowerCase();
      return keywordList.some((keyword) => searchText.includes(keyword));
    });
  }

  // Filter by language pairs for translation jobs
  // Extract user's languages from alert pairs (excluding EN)
  const userLanguages = new Set<string>();
  if (alert.languagePairs.length > 0) {
    for (const pair of alert.languagePairs) {
      if (pair.sourceLanguage !== 'EN') userLanguages.add(pair.sourceLanguage);
      if (pair.targetLanguage !== 'EN') userLanguages.add(pair.targetLanguage);
    }
  }

  filteredJobs = filteredJobs.filter((job) => {
    // For non-translation jobs, no language filtering needed
    if (job.category.slug !== 'translation') {
      // But if user specified language pairs, they only want translation jobs
      if (alert.languagePairs.length > 0) {
        return false;
      }
      return true;
    }

    // This is a translation job - check language matching

    // Collect non-EN languages from the job
    const jobNonEnLanguages = new Set<string>();
    for (const lang of job.sourceLanguages) {
      if (lang !== 'EN') jobNonEnLanguages.add(lang);
    }
    for (const lang of job.targetLanguages) {
      if (lang !== 'EN') jobNonEnLanguages.add(lang);
    }

    // If job has specific non-EN languages (e.g., Indonesian, French)
    // but user has NO language preferences, DON'T send this job
    // This prevents Indonesian jobs going to everyone
    if (jobNonEnLanguages.size > 0 && userLanguages.size === 0) {
      return false;
    }

    // If job has no specific languages, it's a general translation job
    // Anyone subscribed to translation category can receive it
    if (jobNonEnLanguages.size === 0) {
      return true;
    }

    // Both job and user have specific languages - match them
    // Determine matching strategy based on job structure:
    // - If sourceLanguages only has EN (or empty) → multilingual job, user needs ANY target language
    // - If sourceLanguages has non-EN → specific pair job, user needs ALL non-EN languages
    const hasNonEnSource = job.sourceLanguages.some((l) => l !== 'EN');

    if (hasNonEnSource) {
      // Specific language pair job (e.g., FR->ES Interpreter, or RU-PL-NE Medical Interpreter)
      // User must know ALL non-EN languages in the job
      return Array.from(jobNonEnLanguages).every((lang) =>
        userLanguages.has(lang)
      );
    } else {
      // Multilingual job (src=[EN], tgt=[many]) - user needs ANY of the target languages
      // e.g., job has EN->ES, EN->RU, EN->DE - user with ES should match
      return Array.from(jobNonEnLanguages).some((lang) =>
        userLanguages.has(lang)
      );
    }
  });

  return filteredJobs.map((job) => ({
    id: job.id,
    title: job.title,
    slug: job.slug,
    description: job.description,
    company: job.company,
    category: job.category,
    country: job.country,
    level: job.level,
    salaryMin: job.salaryMin,
    salaryMax: job.salaryMax,
    salaryCurrency: job.salaryCurrency,
    postedAt: job.postedAt,
    translationTypes: job.translationTypes as string[],
    sourceLanguages: job.sourceLanguages,
    targetLanguages: job.targetLanguages,
  }));
}

/**
 * Get the "since" date based on frequency
 * Only INSTANT alerts are supported now
 */
function getSinceDate(_frequency: AlertFrequency, lastSentAt: Date | null): Date {
  // If never sent, use last 6 hours as default for instant alerts
  if (!lastSentAt) {
    const now = new Date();
    now.setHours(now.getHours() - 6);
    return now;
  }

  return lastSentAt;
}

/**
 * Find all alerts with matching jobs for a given frequency
 */
export async function findAlertsWithMatches(
  frequency: AlertFrequency
): Promise<AlertWithMatches[]> {
  // Get all active alerts with the specified frequency (only for verified users who haven't unsubscribed)
  const alerts = await prisma.jobAlert.findMany({
    where: {
      isActive: true,
      frequency,
      user: {
        emailVerified: { not: null }, // Only send to verified users
        unsubscribedFromMarketing: false, // Respect unsubscribe preference
      },
    },
    include: {
      languagePairs: true,
    },
  });

  console.log(`[AlertMatcher] Found ${alerts.length} active ${frequency} alerts`);

  const results: AlertWithMatches[] = [];

  for (const alert of alerts) {
    const since = getSinceDate(frequency, alert.lastSentAt);
    const jobs = await findMatchingJobs(
      {
        ...alert,
        languagePairs: alert.languagePairs.map((lp) => ({
          translationType: lp.translationType,
          sourceLanguage: lp.sourceLanguage,
          targetLanguage: lp.targetLanguage,
        })),
      },
      since
    );

    if (jobs.length > 0) {
      results.push({
        alert: {
          ...alert,
          languagePairs: alert.languagePairs.map((lp) => ({
            translationType: lp.translationType,
            sourceLanguage: lp.sourceLanguage,
            targetLanguage: lp.targetLanguage,
          })),
        },
        jobs,
      });
    }
  }

  console.log(
    `[AlertMatcher] ${results.length} alerts have matching jobs`
  );

  return results;
}

/**
 * Mark jobs as sent for an alert
 */
export async function markJobsAsSent(
  alertId: string,
  jobIds: string[]
): Promise<void> {
  await prisma.$transaction([
    // Create notification records
    prisma.alertNotification.createMany({
      data: jobIds.map((jobId) => ({
        jobAlertId: alertId,
        jobId,
      })),
      skipDuplicates: true,
    }),
    // Update alert stats
    prisma.jobAlert.update({
      where: { id: alertId },
      data: {
        lastSentAt: new Date(),
        emailsSent: {
          increment: 1,
        },
      },
    }),
  ]);
}
