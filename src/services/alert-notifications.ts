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
      const jobUrl = `${APP_URL}/company/${job.company.slug}/jobs/${job.slug}`;
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
                    job.company.logo
                      ? `<img src="${job.company.logo}" alt="${job.company.name}" width="50" height="50" style="border-radius: 8px; object-fit: cover;">`
                      : `<div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #666;">${job.company.name.charAt(0)}</div>`
                  }
                </td>
                <td style="padding-left: 15px;">
                  <a href="${jobUrl}" style="color: #000; text-decoration: none; font-weight: 600; font-size: 16px;">
                    ${job.title}
                  </a>
                  <div style="color: #666; font-size: 14px; margin-top: 4px;">
                    ${job.company.name}${job.country ? ` • ${job.country}` : ''}
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
      const jobUrl = `${APP_URL}/company/${job.company.slug}/jobs/${job.slug}`;
      const salary =
        job.salaryMin && job.salaryMax
          ? `${job.salaryCurrency || '$'}${(job.salaryMin / 1000).toFixed(0)}K - ${(job.salaryMax / 1000).toFixed(0)}K`
          : '';
      return `${job.title}\n${job.company.name}${job.country ? ` • ${job.country}` : ''}${salary ? ` • ${salary}` : ''}\n${jobUrl}\n`;
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
 * Send INSTANT alerts for a newly created job
 * Called immediately after job creation
 */
export async function sendInstantAlertsForJob(jobId: string): Promise<{ sent: number; failed: number }> {
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
    return { sent: 0, failed: 0 };
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
    console.log(`[InstantAlerts] No INSTANT alerts configured`);
    return { sent: 0, failed: 0 };
  }

  console.log(`[InstantAlerts] Checking ${instantAlerts.length} INSTANT alerts for job: ${job.title}`);

  let sent = 0;
  let failed = 0;

  for (const alert of instantAlerts) {
    // Check if this job matches the alert criteria
    const matches = checkJobMatchesAlert(job, alert);

    if (!matches) {
      continue;
    }

    // Check if we already sent this job to this alert
    const alreadySent = await prisma.alertNotification.findFirst({
      where: {
        jobAlertId: alert.id,
        jobId: job.id,
      },
    });

    if (alreadySent) {
      continue;
    }

    // Get email from alert or user
    const email = alert.email || alert.user?.email;
    if (!email) {
      continue;
    }

    // Send notification
    const result = await sendAlertNotification({
      alert: {
        id: alert.id,
        email,
        userId: alert.userId,
        category: alert.category,
        keywords: alert.keywords,
        country: alert.country,
        level: alert.level,
        frequency: alert.frequency,
        languagePairs: alert.languagePairs.map((lp) => ({
          translationType: lp.translationType,
          sourceLanguage: lp.sourceLanguage,
          targetLanguage: lp.targetLanguage,
        })),
        lastSentAt: alert.lastSentAt,
      },
      jobs: [{
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
      }],
    });

    if (result.success) {
      sent++;
      console.log(`[InstantAlerts] Sent job "${job.title}" to ${email}`);
    } else {
      failed++;
    }

    // Small delay between sends
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (sent > 0) {
    console.log(`[InstantAlerts] Job "${job.title}": ${sent} instant alerts sent`);
  }

  return { sent, failed };
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
