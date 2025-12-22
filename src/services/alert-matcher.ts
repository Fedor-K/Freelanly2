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

  // Filter by language pairs for translation category
  if (alert.category === 'translation' && alert.languagePairs.length > 0) {
    filteredJobs = filteredJobs.filter((job) => {
      // Check if job has any matching language pair
      return alert.languagePairs.some((alertPair) => {
        // Check translation type match (if job has translation types)
        const typeMatch =
          job.translationTypes.length === 0 ||
          job.translationTypes.includes(alertPair.translationType as never);

        // Check language match
        const sourceMatch =
          job.sourceLanguages.length === 0 ||
          job.sourceLanguages.includes(alertPair.sourceLanguage);

        const targetMatch =
          job.targetLanguages.length === 0 ||
          job.targetLanguages.includes(alertPair.targetLanguage);

        return typeMatch && sourceMatch && targetMatch;
      });
    });
  }

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
 */
function getSinceDate(frequency: AlertFrequency, lastSentAt: Date | null): Date {
  // If never sent, use a reasonable default (7 days for weekly, 1 day for others)
  if (!lastSentAt) {
    const now = new Date();
    switch (frequency) {
      case 'WEEKLY':
        now.setDate(now.getDate() - 7);
        break;
      case 'DAILY':
        now.setDate(now.getDate() - 1);
        break;
      case 'INSTANT':
        now.setHours(now.getHours() - 6); // Last 6 hours for instant
        break;
    }
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
  // Get all active alerts with the specified frequency
  const alerts = await prisma.jobAlert.findMany({
    where: {
      isActive: true,
      frequency,
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
