/**
 * Re-engagement Email Service
 *
 * Sends emails to users who haven't visited in 7+ days
 * to bring them back to the platform.
 *
 * Day 7  - "We noticed you've been away"
 * Day 14 - "New jobs matching your interests"
 * Day 30 - "Your job alerts are waiting"
 */

import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/dashamail';

// ============================================
// EMAIL TEMPLATES
// ============================================

type ReengagementEmailType = 'DAY_7_INACTIVE' | 'DAY_14_INACTIVE' | 'DAY_30_INACTIVE';

interface ReengagementEmailContent {
  subject: string;
  html: string;
}

function getReengagementEmailContent(
  emailType: ReengagementEmailType,
  data: { email: string; name?: string; jobCount?: number; topJobs?: Array<{ title: string; company: string; url: string }> }
): ReengagementEmailContent {
  const baseStyle = `
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
    .header { background: #000; color: #fff; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { padding: 30px; }
    .button { display: inline-block; background: #000; color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .job-card { background: #f9f9f9; padding: 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #000; }
    .job-title { font-weight: 600; color: #000; text-decoration: none; }
    .job-company { color: #666; font-size: 14px; margin-top: 4px; }
    .highlight { background: #f0fdf4; border: 1px solid #86efac; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .footer { padding: 20px 30px; background: #f9f9f9; font-size: 12px; color: #666; text-align: center; }
    .stat { font-size: 32px; font-weight: 700; color: #000; }
  `;

  const greeting = data.name ? `Hi ${data.name}` : 'Hi there';
  const jobsHtml = data.topJobs?.map(job => `
    <div class="job-card">
      <a href="${job.url}" class="job-title">${job.title}</a>
      <div class="job-company">${job.company}</div>
    </div>
  `).join('') || '';

  switch (emailType) {
    case 'DAY_7_INACTIVE':
      return {
        subject: "We noticed you've been away - new jobs are waiting!",
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header">
    <h1>We Miss You!</h1>
  </div>
  <div class="content">
    <p>${greeting},</p>

    <p>It's been a week since your last visit to Freelanly. We wanted to let you know that new remote jobs are being posted every day!</p>

    ${data.jobCount ? `
    <div class="highlight">
      <p style="margin: 0; text-align: center;">
        <span class="stat">${data.jobCount}+</span><br>
        <span style="color: #666;">new jobs posted this week</span>
      </p>
    </div>
    ` : ''}

    ${jobsHtml ? `
    <p><strong>Here are some recent opportunities:</strong></p>
    ${jobsHtml}
    ` : ''}

    <p style="text-align: center;">
      <a href="https://freelanly.com/jobs" class="button">Browse All Jobs</a>
    </p>

    <p>Don't miss out on your next opportunity!</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you have an account at <a href="https://freelanly.com">Freelanly</a>.</p>
    <p><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`,
      };

    case 'DAY_14_INACTIVE':
      return {
        subject: 'Your personalized job matches are waiting',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);">
    <h1>Jobs Matched For You</h1>
  </div>
  <div class="content">
    <p>${greeting},</p>

    <p>Two weeks have passed, and we've been collecting jobs that might interest you. Our system has found matches based on your preferences!</p>

    ${jobsHtml ? `
    <p><strong>Top matches for you:</strong></p>
    ${jobsHtml}
    ` : ''}

    <p>Set up <strong>INSTANT alerts</strong> to get notified immediately when new matching jobs are posted.</p>

    <p style="text-align: center;">
      <a href="https://freelanly.com/dashboard/alerts" class="button" style="background: #2563eb;">Set Up Alerts</a>
    </p>

    <p>The best jobs get filled quickly. Don't wait!</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you have an account at <a href="https://freelanly.com">Freelanly</a>.</p>
    <p><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`,
      };

    case 'DAY_30_INACTIVE':
      return {
        subject: 'Your job alerts are waiting for you',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>${baseStyle}</style></head>
<body>
<div class="container">
  <div class="header" style="background: #059669;">
    <h1>Still Looking?</h1>
  </div>
  <div class="content">
    <p>${greeting},</p>

    <p>It's been a month since we've seen you. If you're still on the job hunt, we're here to help!</p>

    <p>Here's what's waiting for you:</p>

    <ul>
      <li><strong>Fresh jobs daily</strong> from top remote-first companies</li>
      <li><strong>INSTANT alerts</strong> - be first to apply</li>
      <li><strong>Salary insights</strong> - know your worth</li>
      <li><strong>One-click apply</strong> - save time</li>
    </ul>

    ${data.jobCount ? `
    <div class="highlight" style="background: #f0fdf4; border-color: #059669;">
      <p style="margin: 0; text-align: center;">
        We've added <strong>${data.jobCount}+ new jobs</strong> since your last visit!
      </p>
    </div>
    ` : ''}

    <p style="text-align: center;">
      <a href="https://freelanly.com/jobs" class="button" style="background: #059669;">See What's New</a>
    </p>

    <p>Your next opportunity could be one click away.</p>

    <p>Best,<br>The Freelanly Team</p>
  </div>
  <div class="footer">
    <p>You're receiving this because you have an account at <a href="https://freelanly.com">Freelanly</a>.</p>
    <p>This is our last re-engagement email. <a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(data.email)}">Unsubscribe</a></p>
  </div>
</div>
</body>
</html>`,
      };

    default:
      throw new Error(`Unknown re-engagement email type: ${emailType}`);
  }
}

// ============================================
// MAIN PROCESSING FUNCTION
// ============================================

interface InactiveUser {
  id: string;
  email: string;
  name: string | null;
  lastActiveAt: Date | null;
  daysSinceActive: number;
}

/**
 * Get users who haven't been active for X days
 */
async function getInactiveUsers(): Promise<InactiveUser[]> {
  const thirtyFiveDaysAgo = new Date();
  thirtyFiveDaysAgo.setDate(thirtyFiveDaysAgo.getDate() - 35);

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Get users with lastActiveAt between 7 and 35 days ago
  const users = await prisma.user.findMany({
    where: {
      lastActiveAt: {
        gte: thirtyFiveDaysAgo,
        lte: sevenDaysAgo,
      },
      emailVerified: { not: null }, // Only verified users
    },
    select: {
      id: true,
      email: true,
      name: true,
      lastActiveAt: true,
    },
  });

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  return users.map(user => ({
    ...user,
    daysSinceActive: user.lastActiveAt
      ? Math.floor((now.getTime() - user.lastActiveAt.getTime()) / msPerDay)
      : 999,
  }));
}

/**
 * Get which email should be sent based on days inactive
 */
function getEmailTypeForDays(daysSinceActive: number): ReengagementEmailType | null {
  // Send on specific days (with 1-day buffer)
  if (daysSinceActive >= 7 && daysSinceActive <= 8) {
    return 'DAY_7_INACTIVE';
  }
  if (daysSinceActive >= 14 && daysSinceActive <= 15) {
    return 'DAY_14_INACTIVE';
  }
  if (daysSinceActive >= 30 && daysSinceActive <= 31) {
    return 'DAY_30_INACTIVE';
  }
  return null;
}

/**
 * Check if re-engagement email was already sent
 */
async function wasEmailSent(userId: string, emailType: ReengagementEmailType): Promise<boolean> {
  const existing = await prisma.reengagementEmail.findUnique({
    where: {
      userId_emailType: {
        userId,
        emailType,
      },
    },
  });
  return !!existing;
}

/**
 * Record that email was sent
 */
async function recordEmailSent(userId: string, emailType: ReengagementEmailType): Promise<void> {
  await prisma.reengagementEmail.create({
    data: {
      userId,
      emailType,
    },
  });
}

/**
 * Get recent job stats and top jobs
 */
async function getJobsData(): Promise<{ count: number; topJobs: Array<{ title: string; company: string; url: string }> }> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [count, jobs] = await Promise.all([
    prisma.job.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.job.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: {
        company: { select: { name: true, slug: true } },
      },
    }),
  ]);

  return {
    count,
    topJobs: jobs.map(job => ({
      title: job.title,
      company: job.company.name,
      url: `https://freelanly.com/company/${job.company.slug}/jobs/${job.slug}`,
    })),
  };
}

/**
 * Main function: Process all re-engagement emails
 * Should be called by cron daily
 */
export async function processReengagementEmails(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  details: Array<{ email: string; emailType: string; status: string }>;
}> {
  const stats = {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    details: [] as Array<{ email: string; emailType: string; status: string }>,
  };

  try {
    const inactiveUsers = await getInactiveUsers();
    console.log(`[ReengagementEmails] Found ${inactiveUsers.length} inactive users`);

    const jobsData = await getJobsData();
    console.log(`[ReengagementEmails] ${jobsData.count} new jobs this week`);

    for (const user of inactiveUsers) {
      stats.processed++;

      const emailType = getEmailTypeForDays(user.daysSinceActive);
      if (!emailType) {
        continue;
      }

      // Check if already sent
      const alreadySent = await wasEmailSent(user.id, emailType);
      if (alreadySent) {
        stats.skipped++;
        continue;
      }

      // Get email content
      const content = getReengagementEmailContent(emailType, {
        email: user.email,
        name: user.name || undefined,
        jobCount: jobsData.count,
        topJobs: jobsData.topJobs,
      });

      // Send email
      console.log(`[ReengagementEmails] Sending ${emailType} to ${user.email} (${user.daysSinceActive} days inactive)`);

      try {
        const result = await sendApplicationEmail({
          to: user.email,
          subject: content.subject,
          html: content.html,
        });

        if (result.success) {
          await recordEmailSent(user.id, emailType);
          stats.sent++;
          stats.details.push({ email: user.email, emailType, status: 'sent' });
          console.log(`[ReengagementEmails] Sent ${emailType} to ${user.email}`);
        } else {
          stats.failed++;
          stats.details.push({ email: user.email, emailType, status: 'failed' });
          console.error(`[ReengagementEmails] Failed to send ${emailType} to ${user.email}`);
        }
      } catch (error) {
        stats.failed++;
        stats.details.push({ email: user.email, emailType, status: 'error' });
        console.error(`[ReengagementEmails] Error sending to ${user.email}:`, error);
      }
    }
  } catch (error) {
    console.error('[ReengagementEmails] Error processing re-engagement emails:', error);
    throw error;
  }

  return stats;
}
