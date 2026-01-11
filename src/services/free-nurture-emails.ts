/**
 * FREE User Nurture Email System
 *
 * Drip email sequence to convert FREE users to PRO.
 *
 * Email sequence:
 * - WELCOME (Day 1): Right after email verification - 5 personalized job picks
 * - DAY_3: If no apply attempt - "These jobs are going fast"
 * - DAY_7: If still FREE - "Try PRO free for 2 days"
 */

import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/dashamail';
import { siteConfig } from '@/config/site';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;

export type FreeNurtureEmailType = 'WELCOME' | 'DAY_3' | 'DAY_7';

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

interface OpportunityForEmail {
  id: string;
  title: string;
  slug: string;
  clientName: string;
  country: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
}

// ============================================
// EMAIL CONTENT
// ============================================

function getEmailSubject(type: FreeNurtureEmailType, jobCount: number): string {
  switch (type) {
    case 'WELCOME':
      return `Welcome! Here are ${jobCount} remote opportunities for you`;
    case 'DAY_3':
      return `These opportunities won't last - ${jobCount} new matches`;
    case 'DAY_7':
      return 'Unlock unlimited applications - 2 days free';
  }
}

function generateJobCard(job: JobForEmail): string {
  const companySlug = job.company?.slug || 'unknown';
  const jobSlug = job.slug || job.id;
  const jobUrl = `${APP_URL}/company/${companySlug}/jobs/${jobSlug}?utm_source=free_nurture`;

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
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function generateOpportunityCard(opp: OpportunityForEmail): string {
  const oppUrl = `${APP_URL}/freelance/${opp.slug}?utm_source=free_nurture`;

  const salary = opp.salaryMin
    ? `${opp.salaryCurrency || '$'}${opp.salaryMin.toLocaleString()}`
    : null;

  return `
    <tr>
      <td style="padding: 15px 20px; border-bottom: 1px solid #eee;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td width="60" valign="top">
              <div style="width: 50px; height: 50px; background: #f97316; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff;">F</div>
            </td>
            <td style="padding-left: 15px;">
              <a href="${oppUrl}" style="color: #000; text-decoration: none; font-weight: 600; font-size: 15px;">
                ${opp.title}
              </a>
              <div style="color: #666; font-size: 13px; margin-top: 4px;">
                Direct from ${opp.clientName}${opp.country ? ` · ${opp.country}` : ''} · Freelance
              </div>
              ${salary ? `<div style="color: #22c55e; font-size: 13px; margin-top: 4px;">${salary}</div>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function generateFreeNurtureEmailHtml(
  type: FreeNurtureEmailType,
  jobs: JobForEmail[],
  opportunities: OpportunityForEmail[],
  userName?: string | null
): string {
  const name = userName || 'there';

  let headerText = '';
  let introText = '';
  let ctaText = '';
  let ctaUrl = '';

  switch (type) {
    case 'WELCOME':
      headerText = `Welcome to Freelanly, ${name}!`;
      introText = `
        <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          You're now part of a community that finds remote work before everyone else.
        </p>
        <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          Here are some opportunities that match your profile:
        </p>
      `;
      ctaText = 'Browse All Opportunities';
      ctaUrl = `${APP_URL}/jobs?utm_source=free_nurture&utm_campaign=welcome`;
      break;

    case 'DAY_3':
      headerText = `${name}, these won't last long`;
      introText = `
        <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          Remote opportunities get filled fast. The best ones? Usually within a week.
        </p>
        <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          Here are fresh picks you haven't seen yet:
        </p>
      `;
      ctaText = 'See All New Opportunities';
      ctaUrl = `${APP_URL}/jobs?utm_source=free_nurture&utm_campaign=day3`;
      break;

    case 'DAY_7':
      headerText = `Ready to apply, ${name}?`;
      introText = `
        <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          You've been browsing, but haven't applied yet. We get it - taking the first step is hard.
        </p>
        <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          <strong>Good news:</strong> Try PRO free for 2 days. Apply to unlimited jobs, get direct contact info, see full salary data.
        </p>
        <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 20px;">
          No credit card required upfront. Cancel anytime.
        </p>
      `;
      ctaText = 'Start Free Trial';
      ctaUrl = `${APP_URL}/pricing?utm_source=free_nurture&utm_campaign=day7`;
      break;
  }

  // Build job cards HTML
  const jobCardsHtml = jobs.map(generateJobCard).join('');
  const opportunityCardsHtml = opportunities.map(generateOpportunityCard).join('');
  const allCardsHtml = jobCardsHtml + opportunityCardsHtml;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getEmailSubject(type, jobs.length + opportunities.length)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f5;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">

          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; background: #000; text-align: center;">
              <h1 style="margin: 0; color: #fff; font-size: 22px; font-weight: 600;">
                Freelanly
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #000; font-size: 24px; font-weight: 600;">
                ${headerText}
              </h2>
              ${introText}
            </td>
          </tr>

          ${allCardsHtml ? `
          <!-- Job Cards -->
          <tr>
            <td>
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #fafafa;">
                ${allCardsHtml}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding: 40px; text-align: center;">
              <a href="${ctaUrl}" style="display: inline-block; background: #000; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                ${ctaText}
              </a>
              ${type === 'DAY_7' ? `
              <p style="margin: 20px 0 0; color: #666; font-size: 13px;">
                2-day free trial · No credit card · Cancel anytime
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #fafafa; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
                You received this email because you signed up for Freelanly.<br>
                <a href="${APP_URL}/dashboard/settings" style="color: #666;">Manage preferences</a> ·
                <a href="${APP_URL}/dashboard/alerts" style="color: #666;">Update alerts</a>
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

// ============================================
// EMAIL SENDING LOGIC
// ============================================

async function getMatchingJobs(userId: string, limit: number = 3): Promise<JobForEmail[]> {
  // Get user's alert categories for personalization
  const userAlerts = await prisma.jobAlert.findMany({
    where: { userId },
    select: { categoryId: true },
  });
  const categoryIds = userAlerts.map(a => a.categoryId).filter(Boolean) as string[];

  // Get recent jobs, prioritize matching categories
  const jobs = await prisma.job.findMany({
    where: {
      isActive: true,
      postedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      ...(categoryIds.length > 0 ? { categoryId: { in: categoryIds } } : {}),
    },
    include: {
      company: {
        select: { name: true, slug: true, logo: true },
      },
    },
    orderBy: { postedAt: 'desc' },
    take: limit,
  });

  // If not enough category matches, fill with any recent jobs
  if (jobs.length < limit) {
    const moreJobs = await prisma.job.findMany({
      where: {
        isActive: true,
        postedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        id: { notIn: jobs.map(j => j.id) },
      },
      include: {
        company: {
          select: { name: true, slug: true, logo: true },
        },
      },
      orderBy: { postedAt: 'desc' },
      take: limit - jobs.length,
    });
    jobs.push(...moreJobs);
  }

  return jobs;
}

async function getMatchingOpportunities(limit: number = 2): Promise<OpportunityForEmail[]> {
  const opportunities = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      clientName: true,
      country: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
    },
  });

  return opportunities;
}

export async function sendFreeNurtureEmail(
  userId: string,
  type: FreeNurtureEmailType
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, plan: true, emailVerified: true },
  });

  if (!user) {
    return { success: false, error: 'User not found' };
  }

  if (user.plan !== 'FREE') {
    return { success: false, error: 'User is not FREE' };
  }

  if (!user.emailVerified) {
    return { success: false, error: 'Email not verified' };
  }

  try {
    // Get personalized content
    const jobs = await getMatchingJobs(userId, 3);
    const opportunities = await getMatchingOpportunities(2);

    if (jobs.length === 0 && opportunities.length === 0) {
      return { success: false, error: 'No jobs to send' };
    }

    const subject = getEmailSubject(type, jobs.length + opportunities.length);
    const html = generateFreeNurtureEmailHtml(type, jobs, opportunities, user.name);

    // Send via DashaMail
    await sendApplicationEmail({
      to: user.email,
      subject,
      html,
    });

    // Update tracking
    const emailsSent = type === 'WELCOME' ? 1 : type === 'DAY_3' ? 2 : 3;
    await prisma.user.update({
      where: { id: userId },
      data: {
        freeNurtureEmailsSent: emailsSent,
        lastFreeNurtureEmailAt: new Date(),
      },
    });

    console.log(`[FreeNurture] Sent ${type} email to ${user.email}`);
    return { success: true };

  } catch (error) {
    console.error(`[FreeNurture] Failed to send ${type} to ${user.email}:`, error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// CRON LOGIC
// ============================================

export async function processFreeNurtureEmails(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Get FREE users with verified email
  const freeUsers = await prisma.user.findMany({
    where: {
      plan: 'FREE',
      emailVerified: { not: null },
      createdAt: { lte: oneDayAgo }, // At least 1 day old
    },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      emailVerified: true,
      freeNurtureEmailsSent: true,
      lastFreeNurtureEmailAt: true,
      _count: {
        select: { applyAttempts: true },
      },
    },
  });

  console.log(`[FreeNurture] Processing ${freeUsers.length} FREE users`);

  for (const user of freeUsers) {
    // Rate limit: don't send more than once per day
    if (user.lastFreeNurtureEmailAt && user.lastFreeNurtureEmailAt > oneDayAgo) {
      skipped++;
      continue;
    }

    const daysSinceRegistration = Math.floor(
      (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );
    const hasApplyAttempts = user._count.applyAttempts > 0;

    let emailType: FreeNurtureEmailType | null = null;

    // Determine which email to send based on sequence
    if (user.freeNurtureEmailsSent === 0 && daysSinceRegistration >= 1) {
      // Day 1: Welcome email
      emailType = 'WELCOME';
    } else if (user.freeNurtureEmailsSent === 1 && daysSinceRegistration >= 3 && !hasApplyAttempts) {
      // Day 3: If no apply attempts
      emailType = 'DAY_3';
    } else if (user.freeNurtureEmailsSent === 2 && daysSinceRegistration >= 7 && !hasApplyAttempts) {
      // Day 7: Final push for trial
      emailType = 'DAY_7';
    }

    if (!emailType) {
      skipped++;
      continue;
    }

    // Send the email
    const result = await sendFreeNurtureEmail(user.id, emailType);

    if (result.success) {
      sent++;
    } else {
      failed++;
      if (result.error) {
        errors.push(`${user.email}: ${result.error}`);
      }
    }

    // Rate limit between sends
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`[FreeNurture] Done: sent=${sent}, failed=${failed}, skipped=${skipped}`);

  return { sent, failed, skipped, errors };
}

// ============================================
// STATS FOR DASHBOARD
// ============================================

export async function getFreeNurtureStats(): Promise<{
  totalFreeUsers: number;
  sentWelcome: number;
  sentDay3: number;
  sentDay7: number;
  pendingWelcome: number;
  pendingDay3: number;
  pendingDay7: number;
}> {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalFreeUsers,
    sentWelcome,
    sentDay3,
    sentDay7,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        plan: 'FREE',
        emailVerified: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.user.count({
      where: {
        plan: 'FREE',
        freeNurtureEmailsSent: { gte: 1 },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.user.count({
      where: {
        plan: 'FREE',
        freeNurtureEmailsSent: { gte: 2 },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.user.count({
      where: {
        plan: 'FREE',
        freeNurtureEmailsSent: { gte: 3 },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  // Pending = registered but hasn't received email yet
  const pendingWelcome = await prisma.user.count({
    where: {
      plan: 'FREE',
      emailVerified: { not: null },
      freeNurtureEmailsSent: 0,
      createdAt: { gte: oneDayAgo, lte: thirtyDaysAgo },
    },
  });

  const pendingDay3 = await prisma.user.count({
    where: {
      plan: 'FREE',
      emailVerified: { not: null },
      freeNurtureEmailsSent: 1,
      createdAt: { lte: threeDaysAgo },
      applyAttempts: { none: {} },
    },
  });

  const pendingDay7 = await prisma.user.count({
    where: {
      plan: 'FREE',
      emailVerified: { not: null },
      freeNurtureEmailsSent: 2,
      createdAt: { lte: sevenDaysAgo },
      applyAttempts: { none: {} },
    },
  });

  return {
    totalFreeUsers,
    sentWelcome,
    sentDay3,
    sentDay7,
    pendingWelcome,
    pendingDay3,
    pendingDay7,
  };
}
