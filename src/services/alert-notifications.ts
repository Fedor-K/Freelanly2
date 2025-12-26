import { sendApplicationEmail } from '@/lib/dashamail';
import { AlertWithMatches, markJobsAsSent } from './alert-matcher';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;

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
  country: string | null;
  level: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date;
}

/**
 * Generate HTML for job alert email
 */
function generateJobAlertEmailHtml(
  jobs: MatchedJob[],
  alertCategory: string | null,
  unsubscribeUrl: string
): string {
  const categoryName = alertCategory
    ? alertCategory.charAt(0).toUpperCase() + alertCategory.slice(1)
    : 'All Categories';

  const jobCards = jobs
    .map((job) => {
      // Ensure we have valid slugs for URL generation
      const companySlug = job.company?.slug || 'unknown';
      const jobSlug = job.slug || job.id;
      const jobUrl = `${APP_URL}/company/${companySlug}/jobs/${jobSlug}`;
      const salary =
        job.salaryMin && job.salaryMax
          ? `${job.salaryCurrency || '$'}${(job.salaryMin / 1000).toFixed(0)}K - ${(job.salaryMax / 1000).toFixed(0)}K`
          : job.salaryMin
            ? `From ${job.salaryCurrency || '$'}${(job.salaryMin / 1000).toFixed(0)}K`
            : null;

      return `
        <tr>
          <td style="padding: 20px; border-bottom: 1px solid #eee;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="60" valign="top">
                  ${
                    job.company?.logo
                      ? `<img src="${job.company.logo}" alt="${job.company?.name || 'Company'}" width="50" height="50" style="border-radius: 8px; object-fit: cover;">`
                      : `<div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #666;">${(job.company?.name || 'C').charAt(0)}</div>`
                  }
                </td>
                <td style="padding-left: 15px;">
                  <a href="${jobUrl}" style="color: #000; text-decoration: none; font-weight: 600; font-size: 16px;">
                    ${job.title}
                  </a>
                  <div style="color: #666; font-size: 14px; margin-top: 4px;">
                    ${job.company?.name || 'Unknown Company'}${job.country ? ` • ${job.country}` : ''}
                  </div>
                  ${salary ? `<div style="color: #22c55e; font-size: 14px; margin-top: 4px;">${salary}</div>` : ''}
                  <div style="margin-top: 10px;">
                    <a href="${jobUrl}" style="display: inline-block; background: #000; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
                      View Job
                    </a>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f9fafb;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px; text-align: center; border-bottom: 1px solid #eee;">
              <h1 style="margin: 0; font-size: 24px; color: #000;">
                🎯 New Jobs for You
              </h1>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px;">
                ${jobs.length} new ${categoryName} job${jobs.length > 1 ? 's' : ''} matching your alert
              </p>
            </td>
          </tr>

          <!-- Job Cards -->
          ${jobCards}

          <!-- View All Button -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <a href="${APP_URL}/jobs${alertCategory ? `/${alertCategory}` : ''}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">
                View All Jobs
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background: #f9fafb; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 12px;">
                You're receiving this because you set up a job alert on Freelanly.
              </p>
              <p style="margin: 10px 0 0;">
                <a href="${unsubscribeUrl}" style="color: #666; font-size: 12px;">
                  Unsubscribe from this alert
                </a>
                &nbsp;•&nbsp;
                <a href="${APP_URL}/dashboard/alerts" style="color: #666; font-size: 12px;">
                  Manage alerts
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version of email
 */
function generateJobAlertEmailText(
  jobs: MatchedJob[],
  alertCategory: string | null
): string {
  const categoryName = alertCategory || 'All Categories';
  const header = `🎯 New Jobs for You\n${jobs.length} new ${categoryName} jobs matching your alert\n\n`;

  const jobList = jobs
    .map((job) => {
      const companySlug = job.company?.slug || 'unknown';
      const jobSlug = job.slug || job.id;
      const jobUrl = `${APP_URL}/company/${companySlug}/jobs/${jobSlug}`;
      const salary =
        job.salaryMin && job.salaryMax
          ? `${job.salaryCurrency || '$'}${(job.salaryMin / 1000).toFixed(0)}K - ${(job.salaryMax / 1000).toFixed(0)}K`
          : '';
      const companyName = job.company?.name || 'Unknown Company';
      return `${job.title}\n${companyName}${job.country ? ` • ${job.country}` : ''}${salary ? ` • ${salary}` : ''}\n${jobUrl}\n`;
    })
    .join('\n');

  const footer = `\n---\nManage your alerts: ${APP_URL}/dashboard/alerts`;

  return header + jobList + footer;
}

/**
 * Send email notification for an alert
 */
export async function sendAlertNotification(
  alertWithMatches: AlertWithMatches
): Promise<{ success: boolean; error?: string }> {
  const { alert, jobs } = alertWithMatches;

  if (jobs.length === 0) {
    return { success: true }; // Nothing to send
  }

  const unsubscribeUrl = `${APP_URL}/api/user/alerts/${alert.id}/unsubscribe`;

  const subject = `🎯 ${jobs.length} new ${alert.category || ''} job${jobs.length > 1 ? 's' : ''} on Freelanly`;

  const html = generateJobAlertEmailHtml(jobs, alert.category, unsubscribeUrl);
  const text = generateJobAlertEmailText(jobs, alert.category);

  try {
    const result = await sendApplicationEmail({
      to: alert.email,
      subject,
      html,
      text,
    });

    if (result.success) {
      // Mark jobs as sent to prevent duplicates
      await markJobsAsSent(
        alert.id,
        jobs.map((j) => j.id)
      );
      console.log(
        `[AlertNotifications] Sent ${jobs.length} jobs to ${alert.email}`
      );
      return { success: true };
    } else {
      const errorMsg = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error;
      console.error(
        `[AlertNotifications] Failed to send to ${alert.email}: ${errorMsg}`
      );
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error(`[AlertNotifications] Error sending to ${alert.email}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send notifications for multiple alerts
 */
export async function sendAlertNotifications(
  alertsWithMatches: AlertWithMatches[]
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const alertWithMatches of alertsWithMatches) {
    const result = await sendAlertNotification(alertWithMatches);
    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  console.log(
    `[AlertNotifications] Finished: ${sent} sent, ${failed} failed`
  );

  return { sent, failed };
}

/**
 * Queue INSTANT alerts for a newly created job
 * Does NOT send email immediately - just creates PENDING records
 * Cron job will process the queue and send grouped emails
 */
export async function queueInstantAlertsForJob(jobId: string): Promise<{ queued: number }> {
  // Fetch the job with company and category
  const job = await prisma.job.findUnique({
    where: { id: jobId },
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
  });

  if (!job) {
    console.error(`[InstantAlerts] Job ${jobId} not found`);
    return { queued: 0 };
  }

  // Find all active INSTANT alerts
  const instantAlerts = await prisma.jobAlert.findMany({
    where: {
      isActive: true,
      frequency: 'INSTANT',
    },
    include: {
      languagePairs: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  if (instantAlerts.length === 0) {
    return { queued: 0 };
  }

  let queued = 0;

  for (const alert of instantAlerts) {
    // Check if this job matches the alert criteria
    const matches = checkJobMatchesAlert(job, alert);

    if (!matches) {
      continue;
    }

    // Check if already queued or sent for this alert
    const existing = await prisma.alertNotification.findUnique({
      where: {
        jobAlertId_jobId: {
          jobAlertId: alert.id,
          jobId: job.id,
        },
      },
    });

    if (existing) {
      continue; // Already queued or sent
    }

    // Create PENDING notification (will be processed by cron)
    await prisma.alertNotification.create({
      data: {
        jobAlertId: alert.id,
        jobId: job.id,
        status: 'PENDING',
      },
    });
    queued++;
  }

  if (queued > 0) {
    console.log(`[InstantAlerts] Queued job "${job.title}" for ${queued} alerts`);
  }

  return { queued };
}

/**
 * Backward compatibility alias
 * @deprecated Use queueInstantAlertsForJob instead
 */
export const sendInstantAlertsForJob = queueInstantAlertsForJob;

/**
 * Process the INSTANT alert queue
 * Groups pending notifications by user email and sends ONE email per user
 * Called by cron every 5-10 minutes
 */
export async function processInstantAlertQueue(): Promise<{ sent: number; failed: number; processed: number }> {
  // Find all PENDING notifications for INSTANT alerts
  const pendingNotifications = await prisma.alertNotification.findMany({
    where: {
      status: 'PENDING',
      jobAlert: {
        frequency: 'INSTANT',
        isActive: true,
      },
    },
    include: {
      job: {
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
      },
      jobAlert: {
        include: {
          languagePairs: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  if (pendingNotifications.length === 0) {
    console.log(`[InstantAlerts] No pending notifications in queue`);
    return { sent: 0, failed: 0, processed: 0 };
  }

  console.log(`[InstantAlerts] Processing ${pendingNotifications.length} pending notifications`);

  // Group by user email
  const notificationsByEmail = new Map<string, typeof pendingNotifications>();

  for (const notification of pendingNotifications) {
    const email = notification.jobAlert.email || notification.jobAlert.user?.email;
    if (!email) continue;

    const existing = notificationsByEmail.get(email) || [];
    existing.push(notification);
    notificationsByEmail.set(email, existing);
  }

  let sent = 0;
  let failed = 0;
  const processedIds: string[] = [];

  // Send ONE email per user with all their pending jobs
  for (const [email, notifications] of notificationsByEmail) {
    // Dedupe jobs (same job might match multiple alerts for same user)
    const uniqueJobs = new Map<string, typeof notifications[0]['job']>();
    for (const n of notifications) {
      if (!uniqueJobs.has(n.job.id)) {
        uniqueJobs.set(n.job.id, n.job);
      }
    }

    const jobs = Array.from(uniqueJobs.values());
    const firstAlert = notifications[0].jobAlert;

    // Send notification with all jobs
    const result = await sendAlertNotification({
      alert: {
        id: firstAlert.id,
        email,
        userId: firstAlert.userId,
        category: firstAlert.category,
        keywords: firstAlert.keywords,
        country: firstAlert.country,
        level: firstAlert.level,
        frequency: firstAlert.frequency,
        languagePairs: firstAlert.languagePairs.map((lp) => ({
          translationType: lp.translationType,
          sourceLanguage: lp.sourceLanguage,
          targetLanguage: lp.targetLanguage,
        })),
        lastSentAt: firstAlert.lastSentAt,
      },
      jobs: jobs.map((job) => ({
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
      })),
    });

    if (result.success) {
      // Mark all notifications as SENT
      for (const n of notifications) {
        processedIds.push(n.id);
      }
      sent++;
      console.log(`[InstantAlerts] Sent ${jobs.length} jobs to ${email}`);
    } else {
      failed++;
      console.error(`[InstantAlerts] Failed to send to ${email}: ${result.error}`);
    }

    // Small delay between sends
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Mark processed notifications as SENT
  if (processedIds.length > 0) {
    await prisma.alertNotification.updateMany({
      where: {
        id: { in: processedIds },
      },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  console.log(`[InstantAlerts] Queue processed: ${sent} emails sent, ${failed} failed, ${processedIds.length} notifications processed`);

  return { sent, failed, processed: processedIds.length };
}

/**
 * Check if a job matches an alert's criteria
 */
function checkJobMatchesAlert(
  job: {
    category: { slug: string };
    country: string | null;
    level: string;
    title: string;
    description: string;
    translationTypes: string[];
    sourceLanguages: string[];
    targetLanguages: string[];
  },
  alert: {
    category: string | null;
    keywords: string | null;
    country: string | null;
    level: string | null;
    languagePairs: Array<{
      translationType: string;
      sourceLanguage: string;
      targetLanguage: string;
    }>;
  }
): boolean {
  // Category filter
  if (alert.category && job.category.slug !== alert.category) {
    return false;
  }

  // Country filter
  if (alert.country && job.country !== alert.country) {
    return false;
  }

  // Level filter
  if (alert.level && job.level !== alert.level) {
    return false;
  }

  // Keywords filter
  if (alert.keywords) {
    const keywordList = alert.keywords
      .toLowerCase()
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k);

    const searchText = `${job.title} ${job.description}`.toLowerCase();
    const hasKeyword = keywordList.some((keyword) => searchText.includes(keyword));

    if (!hasKeyword) {
      return false;
    }
  }

  // Language pairs filter for translation category
  if (alert.category === 'translation' && alert.languagePairs.length > 0) {
    const hasMatchingPair = alert.languagePairs.some((alertPair) => {
      const typeMatch =
        job.translationTypes.length === 0 ||
        job.translationTypes.includes(alertPair.translationType);

      const sourceMatch =
        job.sourceLanguages.length === 0 ||
        job.sourceLanguages.includes(alertPair.sourceLanguage);

      const targetMatch =
        job.targetLanguages.length === 0 ||
        job.targetLanguages.includes(alertPair.targetLanguage);

      return typeMatch && sourceMatch && targetMatch;
    });

    if (!hasMatchingPair) {
      return false;
    }
  }

  return true;
}
