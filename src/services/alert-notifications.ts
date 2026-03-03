import { sendApplicationEmail } from '@/lib/email';
import { AlertWithMatches, markJobsAsSent } from './alert-matcher';
import { siteConfig } from '@/config/site';
import { prisma } from '@/lib/db';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;

function truncateDescription(description: string, maxLength = 150): string {
  const text = description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
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
  country: string | null;
  level: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date;
}

interface MatchedOpportunity {
  id: string;
  title: string;
  slug: string;
  description: string;
  clientName: string;
  clientAvatar: string | null;
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
                  ${job.description ? `<div style="color: #555; font-size: 13px; margin-top: 6px; line-height: 1.4;">${truncateDescription(job.description)}</div>` : ''}
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
      const desc = job.description ? truncateDescription(job.description) : '';
      return `${job.title}\n${companyName}${job.country ? ` • ${job.country}` : ''}${salary ? ` • ${salary}` : ''}${desc ? `\n${desc}` : ''}\n${jobUrl}\n`;
    })
    .join('\n');

  const footer = `\n---\nManage your alerts: ${APP_URL}/dashboard/alerts`;

  return header + jobList + footer;
}

/**
 * Generate HTML for opportunity alert email
 */
function generateOpportunityAlertEmailHtml(
  opportunities: MatchedOpportunity[],
  alertCategory: string | null,
  unsubscribeUrl: string
): string {
  const categoryName = alertCategory
    ? alertCategory.charAt(0).toUpperCase() + alertCategory.slice(1)
    : 'All Categories';

  const opportunityCards = opportunities
    .map((opp) => {
      const oppUrl = `${APP_URL}/freelance/${opp.slug}`;
      const salary =
        opp.salaryMin && opp.salaryMax
          ? `${opp.salaryCurrency || '$'}${opp.salaryMin} - ${opp.salaryMax}/hr`
          : opp.salaryMin
            ? `From ${opp.salaryCurrency || '$'}${opp.salaryMin}/hr`
            : null;

      return `
        <tr>
          <td style="padding: 20px; border-bottom: 1px solid #eee;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="60" valign="top">
                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff;">💼</div>
                </td>
                <td style="padding-left: 15px;">
                  <a href="${oppUrl}" style="color: #000; text-decoration: none; font-weight: 600; font-size: 16px;">
                    ${opp.title}
                  </a>
                  <div style="color: #666; font-size: 14px; margin-top: 4px;">
                    ${opp.country ? `${opp.country} • ` : ''}Freelance Project
                  </div>
                  ${opp.description ? `<div style="color: #555; font-size: 13px; margin-top: 6px; line-height: 1.4;">${truncateDescription(opp.description)}</div>` : ''}
                  ${salary ? `<div style="color: #22c55e; font-size: 14px; margin-top: 4px;">${salary}</div>` : ''}
                  <div style="margin-top: 10px;">
                    <a href="${oppUrl}" style="display: inline-block; background: #000; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
                      View Project
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
                🎯 New Freelance Projects for You
              </h1>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px;">
                ${opportunities.length} new ${categoryName} project${opportunities.length > 1 ? 's' : ''} matching your alert
              </p>
            </td>
          </tr>

          <!-- Opportunity Cards -->
          ${opportunityCards}

          <!-- View All Button -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <a href="${APP_URL}/freelance" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500;">
                View All Projects
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
 * Generate plain text version of opportunity email
 */
function generateOpportunityAlertEmailText(
  opportunities: MatchedOpportunity[],
  alertCategory: string | null
): string {
  const categoryName = alertCategory || 'All Categories';
  const header = `🎯 New Freelance Projects for You\n${opportunities.length} new ${categoryName} projects matching your alert\n\n`;

  const oppList = opportunities
    .map((opp) => {
      const oppUrl = `${APP_URL}/freelance/${opp.slug}`;
      const salary =
        opp.salaryMin && opp.salaryMax
          ? `${opp.salaryCurrency || '$'}${opp.salaryMin} - ${opp.salaryMax}/hr`
          : '';
      const desc = opp.description ? truncateDescription(opp.description) : '';
      return `${opp.title}\n${opp.country ? `${opp.country} • ` : ''}Freelance Project${salary ? ` • ${salary}` : ''}${desc ? `\n${desc}` : ''}\n${oppUrl}\n`;
    })
    .join('\n');

  const footer = `\n---\nManage your alerts: ${APP_URL}/dashboard/alerts`;

  return header + oppList + footer;
}

/**
 * Generate HTML for COMBINED email with both jobs and opportunities
 * Used when user has matching items of both types
 */
function generateCombinedAlertEmailHtml(
  jobs: MatchedJob[],
  opportunities: MatchedOpportunity[],
  unsubscribeUrl: string
): string {
  const totalItems = jobs.length + opportunities.length;

  // Generate job cards
  const jobCards = jobs
    .map((job) => {
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
                  ${job.description ? `<div style="color: #555; font-size: 13px; margin-top: 6px; line-height: 1.4;">${truncateDescription(job.description)}</div>` : ''}
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

  // Generate opportunity cards
  const opportunityCards = opportunities
    .map((opp) => {
      const oppUrl = `${APP_URL}/freelance/${opp.slug}`;
      const salary =
        opp.salaryMin && opp.salaryMax
          ? `${opp.salaryCurrency || '$'}${opp.salaryMin} - ${opp.salaryMax}/hr`
          : opp.salaryMin
            ? `From ${opp.salaryCurrency || '$'}${opp.salaryMin}/hr`
            : null;

      return `
        <tr>
          <td style="padding: 20px; border-bottom: 1px solid #eee;">
            <table cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td width="60" valign="top">
                  <div style="width: 50px; height: 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff;">💼</div>
                </td>
                <td style="padding-left: 15px;">
                  <a href="${oppUrl}" style="color: #000; text-decoration: none; font-weight: 600; font-size: 16px;">
                    ${opp.title}
                  </a>
                  <div style="color: #666; font-size: 14px; margin-top: 4px;">
                    ${opp.country ? `${opp.country} • ` : ''}Freelance Project
                  </div>
                  ${opp.description ? `<div style="color: #555; font-size: 13px; margin-top: 6px; line-height: 1.4;">${truncateDescription(opp.description)}</div>` : ''}
                  ${salary ? `<div style="color: #22c55e; font-size: 14px; margin-top: 4px;">${salary}</div>` : ''}
                  <div style="margin-top: 10px;">
                    <a href="${oppUrl}" style="display: inline-block; background: #000; color: #fff; padding: 8px 16px; text-decoration: none; border-radius: 6px; font-size: 14px;">
                      View Project
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

  // Build sections - jobs first if any, then opportunities
  const jobsSection = jobs.length > 0 ? `
    <!-- Jobs Section Header -->
    <tr>
      <td style="padding: 20px 20px 10px; background: #f9fafb;">
        <h2 style="margin: 0; font-size: 16px; color: #666; font-weight: 600;">
          Full-Time Jobs (${jobs.length})
        </h2>
      </td>
    </tr>
    ${jobCards}
  ` : '';

  const opportunitiesSection = opportunities.length > 0 ? `
    <!-- Opportunities Section Header -->
    <tr>
      <td style="padding: 20px 20px 10px; background: #f9fafb;">
        <h2 style="margin: 0; font-size: 16px; color: #666; font-weight: 600;">
          Freelance Projects (${opportunities.length})
        </h2>
      </td>
    </tr>
    ${opportunityCards}
  ` : '';

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
                🎯 ${totalItems} New Opportunities for You
              </h1>
              <p style="margin: 10px 0 0; color: #666; font-size: 14px;">
                ${jobs.length > 0 ? `${jobs.length} job${jobs.length > 1 ? 's' : ''}` : ''}${jobs.length > 0 && opportunities.length > 0 ? ' + ' : ''}${opportunities.length > 0 ? `${opportunities.length} freelance project${opportunities.length > 1 ? 's' : ''}` : ''} matching your alerts
              </p>
            </td>
          </tr>

          ${jobsSection}
          ${opportunitiesSection}

          <!-- View All Button -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <a href="${APP_URL}/jobs" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500; margin-right: 10px;">
                View All Jobs
              </a>
              <a href="${APP_URL}/freelance" style="display: inline-block; background: #fff; color: #000; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 500; border: 1px solid #000;">
                View Freelance
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
 * Generate plain text version of combined email
 */
function generateCombinedAlertEmailText(
  jobs: MatchedJob[],
  opportunities: MatchedOpportunity[]
): string {
  const totalItems = jobs.length + opportunities.length;
  const header = `🎯 ${totalItems} New Opportunities for You\n\n`;

  let content = '';

  if (jobs.length > 0) {
    content += `=== Full-Time Jobs (${jobs.length}) ===\n\n`;
    content += jobs
      .map((job) => {
        const companySlug = job.company?.slug || 'unknown';
        const jobSlug = job.slug || job.id;
        const jobUrl = `${APP_URL}/company/${companySlug}/jobs/${jobSlug}`;
        const salary =
          job.salaryMin && job.salaryMax
            ? `${job.salaryCurrency || '$'}${(job.salaryMin / 1000).toFixed(0)}K - ${(job.salaryMax / 1000).toFixed(0)}K`
            : '';
        const companyName = job.company?.name || 'Unknown Company';
        const desc = job.description ? truncateDescription(job.description) : '';
        return `${job.title}\n${companyName}${job.country ? ` • ${job.country}` : ''}${salary ? ` • ${salary}` : ''}${desc ? `\n${desc}` : ''}\n${jobUrl}\n`;
      })
      .join('\n');
    content += '\n';
  }

  if (opportunities.length > 0) {
    content += `=== Freelance Projects (${opportunities.length}) ===\n\n`;
    content += opportunities
      .map((opp) => {
        const oppUrl = `${APP_URL}/freelance/${opp.slug}`;
        const salary =
          opp.salaryMin && opp.salaryMax
            ? `${opp.salaryCurrency || '$'}${opp.salaryMin} - ${opp.salaryMax}/hr`
            : '';
        const desc = opp.description ? truncateDescription(opp.description) : '';
        return `${opp.title}\n${opp.country ? `${opp.country} • ` : ''}Freelance Project${salary ? ` • ${salary}` : ''}${desc ? `\n${desc}` : ''}\n${oppUrl}\n`;
      })
      .join('\n');
  }

  const footer = `\n---\nManage your alerts: ${APP_URL}/dashboard/alerts`;

  return header + content + footer;
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

  // Generate engaging subject line
  // 1 job: "🎯 French Translator at Crystalhues — Remote"
  // Multiple: "🎯 3 new translation jobs for you"
  const subject = jobs.length === 1
    ? `🎯 ${jobs[0].title} at ${jobs[0].company.name}${jobs[0].country ? ` — ${jobs[0].country}` : ''}`
    : `🎯 ${jobs.length} new ${alert.category || ''} jobs for you`;

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

    // Delay to respect Resend rate limit (2 req/sec)
    await new Promise((resolve) => setTimeout(resolve, 200));
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
  // Include alerts with verified users OR alerts without linked user (email-only alerts)
  const instantAlerts = await prisma.jobAlert.findMany({
    where: {
      isActive: true,
      frequency: 'INSTANT',
      OR: [
        // Alerts with linked verified user who hasn't unsubscribed
        {
          user: {
            emailVerified: { not: null },
            unsubscribedFromMarketing: false,
          },
        },
        // Alerts without linked user (email-only, legacy)
        {
          userId: null,
        },
      ],
    },
    include: {
      languagePairs: true,
      user: {
        select: {
          email: true,
          unsubscribedFromMarketing: true,
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
    try {
      await prisma.alertNotification.create({
        data: {
          jobAlertId: alert.id,
          jobId: job.id,
          status: 'PENDING',
        },
      });
      queued++;
    } catch (e: unknown) {
      // P2002 = unique constraint violation (already exists)
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
        continue; // Already queued, skip
      }
      throw e;
    }
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
 * Queue INSTANT alerts for a newly created opportunity
 * Same as queueInstantAlertsForJob but for Opportunity model
 */
export async function queueInstantAlertsForOpportunity(opportunityId: string): Promise<{ queued: number }> {
  // Fetch the opportunity with category and language fields
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      category: {
        select: {
          slug: true,
        },
      },
    },
  });

  // Ensure language arrays exist for checkJobMatchesAlert
  const opportunityWithLangs = opportunity ? {
    ...opportunity,
    sourceLanguages: opportunity.sourceLanguages || [],
    targetLanguages: opportunity.targetLanguages || [],
  } : null;

  if (!opportunityWithLangs) {
    console.error(`[InstantAlerts] Opportunity ${opportunityId} not found`);
    return { queued: 0 };
  }

  // Find all active INSTANT alerts
  // Include alerts with verified users OR alerts without linked user (email-only alerts)
  const instantAlerts = await prisma.jobAlert.findMany({
    where: {
      isActive: true,
      frequency: 'INSTANT',
      OR: [
        // Alerts with linked verified user who hasn't unsubscribed
        {
          user: {
            emailVerified: { not: null },
            unsubscribedFromMarketing: false,
          },
        },
        // Alerts without linked user (email-only, legacy)
        {
          userId: null,
        },
      ],
    },
    include: {
      languagePairs: true,
      user: {
        select: {
          email: true,
          unsubscribedFromMarketing: true,
        },
      },
    },
  });

  if (instantAlerts.length === 0) {
    return { queued: 0 };
  }

  let queued = 0;

  for (const alert of instantAlerts) {
    // Check if this opportunity matches the alert criteria
    const matches = checkJobMatchesAlert(opportunityWithLangs, alert);

    if (!matches) {
      continue;
    }

    // Check if already queued or sent for this alert
    const existing = await prisma.alertNotification.findFirst({
      where: {
        jobAlertId: alert.id,
        opportunityId: opportunityWithLangs.id,
      },
    });

    if (existing) {
      continue; // Already queued or sent
    }

    // Create PENDING notification (will be processed by cron)
    try {
      await prisma.alertNotification.create({
        data: {
          jobAlertId: alert.id,
          opportunityId: opportunityWithLangs.id,
          status: 'PENDING',
        },
      });
      queued++;
    } catch (e: unknown) {
      // P2002 = unique constraint violation (already exists)
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
        continue; // Already queued, skip
      }
      throw e;
    }
  }

  if (queued > 0) {
    console.log(`[InstantAlerts] Queued opportunity "${opportunityWithLangs.title}" for ${queued} alerts`);
  }

  return { queued };
}

/**
 * Alias for opportunity alerts
 */
export const sendInstantAlertsForOpportunity = queueInstantAlertsForOpportunity;

/**
 * Process the INSTANT alert queue
 * Groups pending notifications by user email and sends ONE email per user
 * Called by cron every 2 hours
 *
 * IMPORTANT: We process by UNIQUE EMAILS first (not by notification count)
 * to ensure all notifications for a user are sent in ONE email.
 *
 * Uses PROCESSING status as a lock to prevent race conditions:
 * 1. Find unique emails with PENDING notifications
 * 2. Claim ALL notifications for those emails
 * 3. Process and send ONE email per user
 * 4. Mark as SENT after successful send
 */
// Maximum users to process per batch (Vercel Pro: 60s timeout)
const MAX_USERS_PER_BATCH = 50;

// Minimum time between alert emails for the same user (prevents spam during slow n8n processing)
const MIN_ALERT_INTERVAL_MINUTES = 30;

// Maximum emails per user per day (prevents overwhelming users and Resend limits)
const MAX_EMAILS_PER_USER_PER_DAY = 3;

export async function processInstantAlertQueue(): Promise<{ sent: number; failed: number; processed: number; skippedDebounce: number; skippedDailyLimit: number }> {
  // Generate a unique batch ID for this processing run
  const batchId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // Step 1: Find unique emails with PENDING notifications
  // We group by jobAlert to get unique alert IDs, then extract emails
  const pendingAlerts = await prisma.alertNotification.findMany({
    where: {
      status: 'PENDING',
      jobAlert: {
        frequency: 'INSTANT',
        isActive: true,
      },
    },
    select: {
      jobAlert: {
        select: {
          id: true,
          email: true,
          lastSentAt: true,
          user: {
            select: { email: true },
          },
        },
      },
    },
    distinct: ['jobAlertId'],
  });

  // Extract unique emails with their last send time
  const emailLastSent = new Map<string, Date | null>();
  for (const n of pendingAlerts) {
    const email = n.jobAlert.email || n.jobAlert.user?.email;
    if (email) {
      const normalizedEmail = email.toLowerCase();
      // Keep the most recent lastSentAt for this email
      const existing = emailLastSent.get(normalizedEmail);
      if (!existing || (n.jobAlert.lastSentAt && (!existing || n.jobAlert.lastSentAt > existing))) {
        emailLastSent.set(normalizedEmail, n.jobAlert.lastSentAt);
      }
    }
  }

  if (emailLastSent.size === 0) {
    console.log(`[InstantAlerts] No pending notifications in queue`);
    return { sent: 0, failed: 0, processed: 0, skippedDebounce: 0, skippedDailyLimit: 0 };
  }

  // Get today's start for daily limit check
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Count ACTUAL EMAILS sent today per user (by distinct sentAt timestamps)
  // When we send 1 email with 5 notifications, all 5 get same sentAt timestamp
  // So distinct timestamps = distinct emails
  const allEmailAddresses = Array.from(emailLastSent.keys());
  const todaysSentNotifications = await prisma.alertNotification.findMany({
    where: {
      status: 'SENT',
      sentAt: { gte: todayStart },
      jobAlert: {
        OR: [
          { email: { in: allEmailAddresses, mode: 'insensitive' } },
          { user: { email: { in: allEmailAddresses, mode: 'insensitive' } } },
        ],
      },
    },
    select: {
      sentAt: true,
      jobAlert: {
        select: {
          email: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  // Group by email and count distinct timestamps (= distinct emails)
  const emailTimestamps = new Map<string, Set<number>>();
  for (const n of todaysSentNotifications) {
    const email = (n.jobAlert.email || n.jobAlert.user?.email)?.toLowerCase();
    if (email && n.sentAt) {
      const timestamps = emailTimestamps.get(email) || new Set();
      timestamps.add(n.sentAt.getTime());
      emailTimestamps.set(email, timestamps);
    }
  }

  // Convert to count: number of distinct timestamps = number of emails
  const emailSentToday = new Map<string, number>();
  for (const [email, timestamps] of emailTimestamps) {
    emailSentToday.set(email, timestamps.size);
  }

  // Filter out emails that were sent to recently (debounce) or hit daily limit
  const debounceThreshold = new Date(Date.now() - MIN_ALERT_INTERVAL_MINUTES * 60 * 1000);
  const readyEmails: string[] = [];
  let skippedDebounce = 0;
  let skippedDailyLimit = 0;

  for (const [email, lastSent] of emailLastSent) {
    const sentToday = emailSentToday.get(email) || 0;

    // Check daily limit first
    if (sentToday >= MAX_EMAILS_PER_USER_PER_DAY) {
      skippedDailyLimit++;
      console.log(`[InstantAlerts] Daily limit: skipping ${email} (${sentToday}/${MAX_EMAILS_PER_USER_PER_DAY} emails today)`);
      continue;
    }

    // Check debounce
    if (lastSent && lastSent > debounceThreshold) {
      skippedDebounce++;
      console.log(`[InstantAlerts] Debounce: skipping ${email} (last sent ${Math.round((Date.now() - lastSent.getTime()) / 60000)} min ago)`);
      continue;
    }

    readyEmails.push(email);
  }

  if (readyEmails.length === 0) {
    console.log(`[InstantAlerts] All emails skipped: ${skippedDebounce} debounced, ${skippedDailyLimit} daily limit`);
    return { sent: 0, failed: 0, processed: 0, skippedDebounce, skippedDailyLimit };
  }

  // Limit to MAX_USERS_PER_BATCH users
  const emailsToProcess = readyEmails.slice(0, MAX_USERS_PER_BATCH);
  console.log(`[InstantAlerts] Batch ${batchId}: Found ${emailLastSent.size} unique emails, ${skippedDebounce} debounced, ${skippedDailyLimit} daily limit, processing ${emailsToProcess.length}`);

  // Step 2: Claim ALL PENDING notifications for these emails
  // First, get all notification IDs for these emails
  const notificationsForEmails = await prisma.alertNotification.findMany({
    where: {
      status: 'PENDING',
      jobAlert: {
        frequency: 'INSTANT',
        isActive: true,
        OR: [
          { email: { in: emailsToProcess, mode: 'insensitive' } },
          { user: { email: { in: emailsToProcess, mode: 'insensitive' } } },
        ],
      },
    },
    select: { id: true },
  });

  const idsToProcess = notificationsForEmails.map(n => n.id);

  if (idsToProcess.length === 0) {
    console.log(`[InstantAlerts] No notifications found for emails`);
    return { sent: 0, failed: 0, processed: 0, skippedDebounce, skippedDailyLimit };
  }

  // Atomically claim these notifications
  const claimResult = await prisma.alertNotification.updateMany({
    where: {
      id: { in: idsToProcess },
      status: 'PENDING',
    },
    data: {
      status: 'PROCESSING',
    },
  });

  if (claimResult.count === 0) {
    console.log(`[InstantAlerts] No notifications claimed (already processed by another instance)`);
    return { sent: 0, failed: 0, processed: 0, skippedDebounce, skippedDailyLimit };
  }

  console.log(`[InstantAlerts] Batch ${batchId}: Claimed ${claimResult.count} notifications for ${emailsToProcess.length} users`);

  // Step 2.5: IMMEDIATELY update lastSentAt on all affected alerts
  // This prevents race conditions: other cron instances will see these alerts
  // as recently sent and skip them (debounce check)
  const alertIdsToUpdate = new Set<string>();
  const claimedNotifications = await prisma.alertNotification.findMany({
    where: { id: { in: idsToProcess }, status: 'PROCESSING' },
    select: { jobAlertId: true },
  });
  for (const n of claimedNotifications) {
    alertIdsToUpdate.add(n.jobAlertId);
  }

  if (alertIdsToUpdate.size > 0) {
    await prisma.jobAlert.updateMany({
      where: { id: { in: Array.from(alertIdsToUpdate) } },
      data: { lastSentAt: new Date() },
    });
    console.log(`[InstantAlerts] Batch ${batchId}: Updated lastSentAt on ${alertIdsToUpdate.size} alerts (race condition prevention)`);
  }

  // Step 3: Fetch the claimed notifications with full data
  const pendingNotifications = await prisma.alertNotification.findMany({
    where: {
      id: { in: idsToProcess },
      status: 'PROCESSING',
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
      opportunity: {
        include: {
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

  console.log(`[InstantAlerts] Batch ${batchId}: Processing ${pendingNotifications.length} notifications for ${emailsToProcess.length} users`);

  // Filter out notifications where both job AND opportunity are deleted (orphaned)
  const validNotifications = pendingNotifications.filter(n => n.job !== null || n.opportunity !== null);

  if (validNotifications.length < pendingNotifications.length) {
    const orphanedCount = pendingNotifications.length - validNotifications.length;
    console.log(`[InstantAlerts] Skipping ${orphanedCount} orphaned notifications (deleted jobs/opportunities)`);

    // Mark orphaned notifications as SENT to clear them from queue
    const orphanedIds = pendingNotifications
      .filter(n => n.job === null && n.opportunity === null)
      .map(n => n.id);

    if (orphanedIds.length > 0) {
      await prisma.alertNotification.updateMany({
        where: { id: { in: orphanedIds } },
        data: { status: 'SENT' },
      });
    }
  }

  // Group ALL notifications by email (both jobs and opportunities together)
  // IMPORTANT: Normalize email to lowercase to properly group notifications
  const notificationsByEmail = new Map<string, typeof validNotifications>();

  for (const notification of validNotifications) {
    const rawEmail = notification.jobAlert.email || notification.jobAlert.user?.email;
    if (!rawEmail) continue;
    const email = rawEmail.toLowerCase(); // Normalize to prevent duplicate emails

    const existing = notificationsByEmail.get(email) || [];
    existing.push(notification);
    notificationsByEmail.set(email, existing);
  }

  let sent = 0;
  let failed = 0;
  const processedIds: string[] = [];

  // Send ONE COMBINED email per user with ALL their pending items (jobs + opportunities)
  for (const [email, notifications] of notificationsByEmail) {
    // Collect notification IDs for this email
    for (const n of notifications) {
      processedIds.push(n.id);
    }

    // Dedupe jobs (same job might match multiple alerts for same user)
    const uniqueJobs = new Map<string, NonNullable<typeof notifications[0]['job']>>();
    for (const n of notifications) {
      if (n.job && !uniqueJobs.has(n.job.id)) {
        uniqueJobs.set(n.job.id, n.job);
      }
    }

    // Dedupe opportunities
    const uniqueOpps = new Map<string, NonNullable<typeof notifications[0]['opportunity']>>();
    for (const n of notifications) {
      if (n.opportunity && !uniqueOpps.has(n.opportunity.id)) {
        uniqueOpps.set(n.opportunity.id, n.opportunity);
      }
    }

    const jobs = Array.from(uniqueJobs.values());
    const opportunities = Array.from(uniqueOpps.values());
    const firstAlert = notifications[0].jobAlert;

    // Determine which email format to use based on what content we have
    let result: { success: boolean; error?: string };

    if (jobs.length > 0 && opportunities.length > 0) {
      // COMBINED email: both jobs AND opportunities
      result = await sendCombinedAlertNotification({
        alertId: firstAlert.id,
        email,
        jobs: jobs.map((job) => ({
          id: job.id,
          title: job.title,
          slug: job.slug,
          description: job.description,
          company: job.company,
          country: job.country,
          level: job.level,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          postedAt: job.postedAt,
        })),
        opportunities: opportunities.map((opp) => ({
          id: opp.id,
          title: opp.title,
          slug: opp.slug,
          description: opp.description,
          clientName: opp.clientName,
          clientAvatar: opp.clientAvatar,
          country: opp.country,
          level: opp.level,
          salaryMin: opp.salaryMin,
          salaryMax: opp.salaryMax,
          salaryCurrency: opp.salaryCurrency,
          postedAt: opp.postedAt,
        })),
      });
      if (result.success) {
        console.log(`[InstantAlerts] Sent COMBINED email (${jobs.length} jobs + ${opportunities.length} opportunities) to ${email}`);
      }
    } else if (opportunities.length > 0) {
      // Only opportunities
      result = await sendOpportunityAlertNotification({
        alertId: firstAlert.id,
        email,
        category: firstAlert.category,
        opportunities: opportunities.map((opp) => ({
          id: opp.id,
          title: opp.title,
          slug: opp.slug,
          description: opp.description,
          clientName: opp.clientName,
          clientAvatar: opp.clientAvatar,
          country: opp.country,
          level: opp.level,
          salaryMin: opp.salaryMin,
          salaryMax: opp.salaryMax,
          salaryCurrency: opp.salaryCurrency,
          postedAt: opp.postedAt,
        })),
      });
      if (result.success) {
        console.log(`[InstantAlerts] Sent ${opportunities.length} opportunities to ${email}`);
      }
    } else if (jobs.length > 0) {
      // Only jobs
      result = await sendAlertNotification({
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
        console.log(`[InstantAlerts] Sent ${jobs.length} jobs to ${email}`);
      }
    } else {
      // No items (shouldn't happen, but handle gracefully)
      result = { success: true };
      console.log(`[InstantAlerts] No items to send to ${email}, skipping`);
    }

    if (result.success) {
      sent++;
      // Increment emailsSent counter for all alerts that were part of this email
      const alertIdsForEmail = new Set(notifications.map(n => n.jobAlertId));
      if (alertIdsForEmail.size > 0) {
        await prisma.jobAlert.updateMany({
          where: { id: { in: Array.from(alertIdsForEmail) } },
          data: { emailsSent: { increment: 1 } },
        });
      }
    } else {
      failed++;
      console.error(`[InstantAlerts] Failed to send to ${email}: ${result.error}`);
    }
  }

  // Mark all processed notifications as SENT (including failed ones to prevent infinite retries)
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

  console.log(`[InstantAlerts] Batch ${batchId}: ${sent} emails sent, ${failed} failed, ${processedIds.length} notifications processed, ${skippedDebounce} debounced, ${skippedDailyLimit} daily limit`);

  return { sent, failed, processed: processedIds.length, skippedDebounce, skippedDailyLimit };
}

/**
 * Send email notification for opportunities
 */
async function sendOpportunityAlertNotification(params: {
  alertId: string;
  email: string;
  category: string | null;
  opportunities: MatchedOpportunity[];
}): Promise<{ success: boolean; error?: string }> {
  const { alertId, email, category, opportunities } = params;

  if (opportunities.length === 0) {
    return { success: true };
  }

  const unsubscribeUrl = `${APP_URL}/api/user/alerts/${alertId}/unsubscribe`;

  // Generate subject line (don't include client name - may be personal)
  const subject = opportunities.length === 1
    ? `🎯 ${opportunities[0].title} — Freelance Project`
    : `🎯 ${opportunities.length} new freelance projects for you`;

  const html = generateOpportunityAlertEmailHtml(opportunities, category, unsubscribeUrl);
  const text = generateOpportunityAlertEmailText(opportunities, category);

  try {
    const result = await sendApplicationEmail({
      to: email,
      subject,
      html,
      text,
    });

    if (result.success) {
      console.log(`[AlertNotifications] Sent ${opportunities.length} opportunities to ${email}`);
      return { success: true };
    } else {
      const errorMsg = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error;
      console.error(`[AlertNotifications] Failed to send opportunities to ${email}: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error(`[AlertNotifications] Error sending opportunities to ${email}:`, error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send COMBINED email notification with both jobs and opportunities
 */
async function sendCombinedAlertNotification(params: {
  alertId: string;
  email: string;
  jobs: MatchedJob[];
  opportunities: MatchedOpportunity[];
}): Promise<{ success: boolean; error?: string }> {
  const { alertId, email, jobs, opportunities } = params;

  const totalItems = jobs.length + opportunities.length;
  if (totalItems === 0) {
    return { success: true };
  }

  const unsubscribeUrl = `${APP_URL}/api/user/alerts/${alertId}/unsubscribe`;

  // Generate subject line for combined email
  const subject = `🎯 ${totalItems} new opportunities for you`;

  const html = generateCombinedAlertEmailHtml(jobs, opportunities, unsubscribeUrl);
  const text = generateCombinedAlertEmailText(jobs, opportunities);

  try {
    const result = await sendApplicationEmail({
      to: email,
      subject,
      html,
      text,
    });

    if (result.success) {
      console.log(`[AlertNotifications] Sent combined email (${jobs.length} jobs + ${opportunities.length} opportunities) to ${email}`);
      return { success: true };
    } else {
      const errorMsg = typeof result.error === 'object' ? JSON.stringify(result.error) : result.error;
      console.error(`[AlertNotifications] Failed to send combined email to ${email}: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error(`[AlertNotifications] Error sending combined email to ${email}:`, error);
    return { success: false, error: String(error) };
  }
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
  // Skip alerts with ALL null filters - too broad, would match ALL jobs
  const hasAnyFilter = !!(
    alert.category ||
    alert.keywords ||
    alert.country ||
    alert.level ||
    alert.languagePairs.length > 0
  );
  if (!hasAnyFilter) {
    return false;
  }

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

  // Language filtering for ALL jobs/opportunities (not just translation)
  // Extract user's languages from alert pairs (excluding EN)
  const userLanguages = new Set<string>();
  if (alert.languagePairs.length > 0) {
    for (const pair of alert.languagePairs) {
      if (pair.sourceLanguage !== 'EN') userLanguages.add(pair.sourceLanguage);
      if (pair.targetLanguage !== 'EN') userLanguages.add(pair.targetLanguage);
    }
  }

  // Collect non-EN languages from the job (check for ANY category)
  const jobNonEnLanguages = new Set<string>();
  for (const lang of job.sourceLanguages) {
    if (lang !== 'EN') jobNonEnLanguages.add(lang);
  }
  for (const lang of job.targetLanguages) {
    if (lang !== 'EN') jobNonEnLanguages.add(lang);
  }

  // UNIVERSAL LANGUAGE CHECK (applies to ALL categories):
  // If job requires specific non-EN languages but user has NO language preferences,
  // DON'T send this job. This prevents Arabic writing jobs going to non-Arabic speakers.
  if (jobNonEnLanguages.size > 0 && userLanguages.size === 0) {
    return false;
  }

  // For non-translation jobs with no specific languages, send to everyone
  if (job.category.slug !== 'translation') {
    // If user specified language pairs, they only want translation jobs
    if (alert.languagePairs.length > 0) {
      return false;
    }
    // Job has no specific languages OR user has matching languages
    if (jobNonEnLanguages.size === 0) {
      return true;
    }
    // Job has specific languages - check if user has ANY of them
    return Array.from(jobNonEnLanguages).some((lang) => userLanguages.has(lang));
  }

  // This is a translation job - apply stricter language matching

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
}
