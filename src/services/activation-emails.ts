/**
 * Activation Email System
 *
 * Ensures new PRO subscribers send applications within first 7 days.
 *
 * Email sequence:
 * - WELCOME (Day 0): Right after payment - 10 personalized job picks
 * - DAY_1: 24h after payment if 0 applications
 * - DAY_2: 48h after payment if 0 applications
 * - DAY_3: 72h after payment if 0 applications (final)
 */

import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/dashamail';
import { siteConfig } from '@/config/site';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;

// Target: 3 applications in first 7 days
export const ACTIVATION_TARGET = 3;
export const ACTIVATION_WINDOW_DAYS = 7;

export type ActivationEmailType = 'WELCOME' | 'DAY_1' | 'DAY_2' | 'DAY_3';

interface JobForEmail {
  id: string;
  title: string;
  slug: string;
  company: {
    name: string;
    slug: string;
    logo: string | null;
  };
  country: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date;
}

// ============================================
// EMAIL CONTENT
// ============================================

function getEmailSubject(type: ActivationEmailType, jobCount: number): string {
  switch (type) {
    case 'WELCOME':
      return `Welcome to PRO! Here are ${jobCount} jobs for you`;
    case 'DAY_1':
      return `You haven't applied yet - ${jobCount} new matches`;
    case 'DAY_2':
      return 'Jobs are filling up - apply now';
    case 'DAY_3':
      return 'Last reminder: Your perfect job is waiting';
  }
}

function generateJobCard(job: JobForEmail): string {
  const companySlug = job.company?.slug || 'unknown';
  const jobSlug = job.slug || job.id;
  const jobUrl = `${APP_URL}/company/${companySlug}/jobs/${jobSlug}?utm_source=activation_email`;

  const salary = job.salaryMin && job.salaryMax
    ? `${job.salaryCurrency || '$'}${(job.salaryMin / 1000).toFixed(0)}K - ${(job.salaryMax / 1000).toFixed(0)}K`
    : job.salaryMin
      ? `From ${job.salaryCurrency || '$'}${(job.salaryMin / 1000).toFixed(0)}K`
      : null;

  const logoHtml = job.company?.logo
    ? `<img src="${job.company.logo}" alt="${job.company?.name || 'Company'}" width="50" height="50" style="border-radius: 8px; object-fit: cover;">`
    : `<div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #666;">${(job.company?.name || 'C').charAt(0)}</div>`;

  return `
    <tr>
      <td style="padding: 15px 20px; border-bottom: 1px solid #eee;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="60" valign="top">${logoHtml}</td>
            <td style="padding-left: 15px;">
              <a href="${jobUrl}" style="color: #000; text-decoration: none; font-weight: 600; font-size: 15px;">
                ${job.title}
              </a>
              <div style="color: #666; font-size: 13px; margin-top: 4px;">
                ${job.company?.name || 'Unknown Company'}${job.country ? ` · ${job.country}` : ''}
              </div>
              ${salary ? `<div style="color: #22c55e; font-size: 13px; margin-top: 4px;">${salary}</div>` : ''}
              <div style="margin-top: 8px;">
                <a href="${jobUrl}" style="display: inline-block; background: #000; color: #fff; padding: 6px 14px; text-decoration: none; border-radius: 6px; font-size: 13px;">
                  Apply Now
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function generateActivationEmailHtml(
  type: ActivationEmailType,
  jobs: JobForEmail[],
  userName?: string | null,
  email?: string
): string {
  const greeting = userName ? `Hi ${userName.split(' ')[0]}!` : 'Hi there!';
  const jobCards = jobs.map(generateJobCard).join('');
  const browseUrl = `${APP_URL}/jobs?utm_source=activation_email`;

  let introText: string;
  let ctaText: string;

  switch (type) {
    case 'WELCOME':
      introText = `
        <p>Congratulations on upgrading to <strong>PRO</strong>! 🎉</p>
        <p>You now have unlimited access to apply to jobs. Here are ${jobs.length} hand-picked opportunities based on your preferences:</p>
      `;
      ctaText = 'Browse All Jobs';
      break;
    case 'DAY_1':
      introText = `
        <p>We noticed you haven't applied to any jobs yet.</p>
        <p>Don't miss out! Here are ${jobs.length} fresh opportunities that match your profile:</p>
      `;
      ctaText = 'Start Applying';
      break;
    case 'DAY_2':
      introText = `
        <p><strong>Jobs are getting filled fast.</strong></p>
        <p>The best opportunities don't wait. Here are ${jobs.length} jobs you should check out today:</p>
      `;
      ctaText = 'Apply Before They\'re Gone';
      break;
    case 'DAY_3':
      introText = `
        <p>This is your last reminder.</p>
        <p>You have PRO access but haven't applied yet. Here are ${jobs.length} opportunities waiting for you:</p>
      `;
      ctaText = 'Apply Now';
      break;
  }

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
            <td style="padding: 30px; text-align: center; background: #000; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 24px; color: #fff;">Freelanly</h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="font-size: 16px; color: #333; margin: 0 0 15px 0;">${greeting}</p>
              <div style="font-size: 15px; color: #333; line-height: 1.6;">
                ${introText}
              </div>
            </td>
          </tr>

          <!-- Job Cards -->
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #fafafa;">
                ${jobCards}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding: 30px; text-align: center;">
              <a href="${browseUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                ${ctaText}
              </a>
            </td>
          </tr>

          <!-- Pro tip -->
          ${type === 'WELCOME' ? `
          <tr>
            <td style="padding: 0 30px 30px 30px;">
              <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 15px;">
                <strong style="color: #166534;">💡 Pro tip:</strong>
                <span style="color: #166534;">The sooner you apply, the better your chances. Most positions get filled within the first week.</span>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background: #f9f9f9; border-radius: 0 0 12px 12px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #666;">
                You're receiving this because you have a PRO subscription on <a href="${APP_URL}" style="color: #666;">Freelanly</a>.
                ${email ? `<br><a href="${APP_URL}/dashboard/alerts" style="color: #666;">Manage job alerts</a> | <a href="${getUnsubscribeUrl(email)}" style="color: #666;">Unsubscribe</a>` : ''}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function generateActivationEmailText(
  type: ActivationEmailType,
  jobs: JobForEmail[],
  userName?: string | null
): string {
  const greeting = userName ? `Hi ${userName.split(' ')[0]}!` : 'Hi there!';

  let intro: string;
  switch (type) {
    case 'WELCOME':
      intro = `Congratulations on upgrading to PRO!\n\nHere are ${jobs.length} jobs for you:`;
      break;
    case 'DAY_1':
      intro = `You haven't applied yet. Here are ${jobs.length} new matches:`;
      break;
    case 'DAY_2':
      intro = `Jobs are filling up fast. Here are ${jobs.length} opportunities:`;
      break;
    case 'DAY_3':
      intro = `Last reminder! Here are ${jobs.length} jobs waiting for you:`;
      break;
  }

  const jobList = jobs.map(job => {
    const salary = job.salaryMin ? ` - ${job.salaryCurrency || '$'}${(job.salaryMin / 1000).toFixed(0)}K+` : '';
    return `- ${job.title} at ${job.company?.name}${salary}\n  ${APP_URL}/company/${job.company?.slug}/jobs/${job.slug}`;
  }).join('\n\n');

  return `${greeting}\n\n${intro}\n\n${jobList}\n\n---\nFreelAnly - Remote Jobs`;
}

// ============================================
// SEND ACTIVATION EMAIL
// ============================================

export async function sendActivationEmail(
  userId: string,
  type: ActivationEmailType
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user with their preferences
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        jobAlerts: {
          select: { category: true },
          take: 5,
        },
      },
    });

    if (!user || !user.email) {
      return { success: false, error: 'User not found' };
    }

    // Get categories from user's alerts
    const categories = user.jobAlerts
      .map(a => a.category)
      .filter((c): c is string => c !== null);

    // Fetch matching jobs
    const jobs = await prisma.job.findMany({
      where: {
        isActive: true,
        ...(categories.length > 0 && {
          category: { slug: { in: categories } },
        }),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        country: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        postedAt: true,
        company: {
          select: {
            name: true,
            slug: true,
            logo: true,
          },
        },
      },
      orderBy: { postedAt: 'desc' },
      take: type === 'WELCOME' ? 10 : 5,
    });

    if (jobs.length === 0) {
      console.log(`[Activation] No jobs found for user ${user.email}`);
      return { success: false, error: 'No jobs found' };
    }

    // Generate email content
    const subject = getEmailSubject(type, jobs.length);
    const html = generateActivationEmailHtml(type, jobs, user.name, user.email);
    const text = generateActivationEmailText(type, jobs, user.name);

    // Send email
    const result = await sendApplicationEmail({
      to: user.email,
      subject,
      html,
      text,
    });

    if (!result.success) {
      console.error(`[Activation] Failed to send ${type} email to ${user.email}:`, result.error);
      return { success: false, error: result.error };
    }

    // Update user's activation tracking
    const emailNumber = {
      'WELCOME': 1,
      'DAY_1': 2,
      'DAY_2': 3,
      'DAY_3': 4,
    }[type];

    await prisma.user.update({
      where: { id: userId },
      data: {
        activationEmailsSent: emailNumber,
        lastActivationEmailAt: new Date(),
        // Set proStartedAt on welcome email
        ...(type === 'WELCOME' && { proStartedAt: new Date() }),
      },
    });

    console.log(`[Activation] Sent ${type} email to ${user.email} (${jobs.length} jobs)`);
    return { success: true };
  } catch (error) {
    console.error('[Activation] Error sending email:', error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// PROCESS ACTIVATION EMAILS (CRON)
// ============================================

export async function processActivationEmails(): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  const stats = { processed: 0, sent: 0, errors: [] as string[] };

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Find PRO users who haven't applied yet and are within activation window
    const usersToProcess = await prisma.user.findMany({
      where: {
        plan: 'PRO',
        proStartedAt: {
          not: null,
          gte: sevenDaysAgo, // Within 7-day window
        },
        activatedAt: null, // Haven't sent any application yet
        activationEmailsSent: { lt: 4 }, // Haven't received all drip emails
        unsubscribedFromMarketing: false, // Respect unsubscribe preference
      },
      include: {
        _count: {
          select: { applications: true },
        },
      },
    });

    console.log(`[Activation] Found ${usersToProcess.length} users to check`);

    for (const user of usersToProcess) {
      stats.processed++;

      // Skip if user already has applications (activated)
      if (user._count.applications > 0) {
        // Mark as activated
        await prisma.user.update({
          where: { id: user.id },
          data: { activatedAt: new Date() },
        });
        continue;
      }

      const proStarted = user.proStartedAt!;
      let emailType: ActivationEmailType | null = null;

      // Determine which email to send based on days since PRO started
      if (user.activationEmailsSent === 1 && proStarted <= oneDayAgo) {
        emailType = 'DAY_1';
      } else if (user.activationEmailsSent === 2 && proStarted <= twoDaysAgo) {
        emailType = 'DAY_2';
      } else if (user.activationEmailsSent === 3 && proStarted <= threeDaysAgo) {
        emailType = 'DAY_3';
      }

      if (emailType) {
        // Rate limit: don't send if last email was less than 20 hours ago
        if (user.lastActivationEmailAt) {
          const hoursSinceLastEmail = (now.getTime() - user.lastActivationEmailAt.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastEmail < 20) {
            continue;
          }
        }

        const result = await sendActivationEmail(user.id, emailType);
        if (result.success) {
          stats.sent++;
        } else {
          stats.errors.push(`${user.email}: ${result.error}`);
        }

        // Rate limit between sends
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[Activation] Processed: ${stats.processed}, Sent: ${stats.sent}, Errors: ${stats.errors.length}`);
    return stats;
  } catch (error) {
    console.error('[Activation] Process error:', error);
    stats.errors.push(String(error));
    return stats;
  }
}

// ============================================
// ACTIVATION STATS (FOR ADMIN)
// ============================================

export async function getActivationStats(): Promise<{
  totalProUsers: number;
  activatedCount: number;
  pendingCount: number;
  atRiskCount: number;
  neverAppliedChurned: number;
  avgDaysToFirstApply: number | null;
  emailStats: {
    welcomeSent: number;
    day1Sent: number;
    day2Sent: number;
    day3Sent: number;
  };
  recentUsers: Array<{
    id: string;
    email: string;
    name: string | null;
    proStartedAt: Date | null;
    applicationCount: number;
    activationEmailsSent: number;
    status: 'activated' | 'pending' | 'at-risk' | 'churned';
  }>;
}> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Get all recent PRO users (last 30 days)
  const proUsers = await prisma.user.findMany({
    where: {
      OR: [
        { plan: 'PRO' },
        {
          plan: 'FREE',
          proStartedAt: { not: null, gte: thirtyDaysAgo },
        },
      ],
      proStartedAt: { gte: thirtyDaysAgo },
    },
    include: {
      _count: {
        select: { applications: true },
      },
    },
    orderBy: { proStartedAt: 'desc' },
  });

  let activatedCount = 0;
  let pendingCount = 0;
  let atRiskCount = 0;
  let neverAppliedChurned = 0;
  let totalDaysToFirstApply = 0;
  let usersWithFirstApply = 0;

  const emailStats = {
    welcomeSent: 0,
    day1Sent: 0,
    day2Sent: 0,
    day3Sent: 0,
  };

  const recentUsers: Array<{
    id: string;
    email: string;
    name: string | null;
    proStartedAt: Date | null;
    applicationCount: number;
    activationEmailsSent: number;
    status: 'activated' | 'pending' | 'at-risk' | 'churned';
  }> = [];

  for (const user of proUsers) {
    const applicationCount = user._count.applications;
    const isWithinWindow = user.proStartedAt && user.proStartedAt >= sevenDaysAgo;
    const isChurned = user.plan === 'FREE';

    // Count email stats
    if (user.activationEmailsSent >= 1) emailStats.welcomeSent++;
    if (user.activationEmailsSent >= 2) emailStats.day1Sent++;
    if (user.activationEmailsSent >= 3) emailStats.day2Sent++;
    if (user.activationEmailsSent >= 4) emailStats.day3Sent++;

    // Determine status
    let status: 'activated' | 'pending' | 'at-risk' | 'churned';

    if (applicationCount >= ACTIVATION_TARGET) {
      status = 'activated';
      activatedCount++;
    } else if (isChurned) {
      status = 'churned';
      if (applicationCount === 0) neverAppliedChurned++;
    } else if (applicationCount > 0) {
      status = 'pending';
      pendingCount++;
    } else if (isWithinWindow) {
      status = 'pending';
      pendingCount++;
    } else {
      status = 'at-risk';
      atRiskCount++;
    }

    // Calculate days to first apply
    if (user.activatedAt && user.proStartedAt) {
      const days = (user.activatedAt.getTime() - user.proStartedAt.getTime()) / (1000 * 60 * 60 * 24);
      totalDaysToFirstApply += days;
      usersWithFirstApply++;
    }

    recentUsers.push({
      id: user.id,
      email: user.email,
      name: user.name,
      proStartedAt: user.proStartedAt,
      applicationCount,
      activationEmailsSent: user.activationEmailsSent,
      status,
    });
  }

  return {
    totalProUsers: proUsers.length,
    activatedCount,
    pendingCount,
    atRiskCount,
    neverAppliedChurned,
    avgDaysToFirstApply: usersWithFirstApply > 0
      ? Math.round((totalDaysToFirstApply / usersWithFirstApply) * 10) / 10
      : null,
    emailStats,
    recentUsers: recentUsers.slice(0, 50), // Limit to 50 most recent
  };
}
