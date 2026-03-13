/**
 * FOMO Email Service
 *
 * Sends "You missed X projects this week" email to FREE users
 * 3 days after registration to create urgency and drive PRO conversion.
 *
 * Timing: 72h ± 12h window after registration
 * Trigger: Daily cron at 9:00 UTC
 */

import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/email';
import { siteConfig } from '@/config/site';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;

interface OpportunityForFomo {
  id: string;
  title: string;
  slug: string;
  clientName: string;
  country: string | null;
  description: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date;
  category: {
    slug: string;
  };
}

interface JobForFomo {
  id: string;
  title: string;
  slug: string;
  company: {
    name: string;
    slug: string;
    logo: string | null;
  };
  country: string | null;
  description: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  postedAt: Date;
  category: {
    slug: string;
  };
}

// ============================================
// CONTENT FETCHING
// ============================================

async function getProjectsForUser(
  userId: string
): Promise<{ opportunities: OpportunityForFomo[]; jobs: JobForFomo[]; totalCount: number }> {
  // Get user's categories from alerts
  const userAlerts = await prisma.jobAlert.findMany({
    where: { userId },
    select: { category: true },
  });
  const categorySlugs = userAlerts.map(a => a.category).filter(Boolean) as string[];

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Count total projects this week
  const [totalOpps, totalJobs] = await Promise.all([
    prisma.opportunity.count({
      where: {
        isActive: true,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.job.count({
      where: {
        isActive: true,
        postedAt: { gte: sevenDaysAgo },
      },
    }),
  ]);
  const totalCount = totalOpps + totalJobs;

  // Fetch opportunities (prioritize user's categories)
  const categoryFilter = categorySlugs.length > 0
    ? { category: { slug: { in: categorySlugs } } }
    : {};

  let opportunities = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      createdAt: { gte: sevenDaysAgo },
      ...categoryFilter,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      clientName: true,
      country: true,
      description: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      postedAt: true,
      category: { select: { slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  // Fill with any category if not enough
  if (opportunities.length < 3) {
    const moreOpps = await prisma.opportunity.findMany({
      where: {
        isActive: true,
        createdAt: { gte: sevenDaysAgo },
        id: { notIn: opportunities.map(o => o.id) },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        clientName: true,
        country: true,
        description: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        postedAt: true,
        category: { select: { slug: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 3 - opportunities.length,
    });
    opportunities = [...opportunities, ...moreOpps];
  }

  // Fetch jobs if still need more items
  let jobs: JobForFomo[] = [];
  const neededJobs = 5 - opportunities.length;
  if (neededJobs > 0) {
    jobs = await prisma.job.findMany({
      where: {
        isActive: true,
        postedAt: { gte: sevenDaysAgo },
        ...(categorySlugs.length > 0 ? { category: { slug: { in: categorySlugs } } } : {}),
      },
      select: {
        id: true,
        title: true,
        slug: true,
        company: { select: { name: true, slug: true, logo: true } },
        country: true,
        description: true,
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        postedAt: true,
        category: { select: { slug: true } },
      },
      orderBy: { postedAt: 'desc' },
      take: neededJobs,
    });

    // Fill with any category
    if (jobs.length < neededJobs) {
      const moreJobs = await prisma.job.findMany({
        where: {
          isActive: true,
          postedAt: { gte: sevenDaysAgo },
          id: { notIn: jobs.map(j => j.id) },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          company: { select: { name: true, slug: true, logo: true } },
          country: true,
          description: true,
          salaryMin: true,
          salaryMax: true,
          salaryCurrency: true,
          postedAt: true,
          category: { select: { slug: true } },
        },
        orderBy: { postedAt: 'desc' },
        take: neededJobs - jobs.length,
      });
      jobs = [...jobs, ...moreJobs];
    }
  }

  return { opportunities, jobs, totalCount };
}

// ============================================
// EMAIL HTML
// ============================================

function getDaysAgo(date: Date): string {
  const days = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function truncateDescription(desc: string, maxLen: number = 120): string {
  if (!desc) return '';
  const clean = desc.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen).replace(/\s\S*$/, '') + '...';
}

function generateFomoProjectCard(
  title: string,
  subtitle: string,
  description: string,
  postedAt: Date,
  url: string,
  logoHtml: string
): string {
  return `
    <tr>
      <td style="padding: 0 40px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden;">
          <tr>
            <td style="padding: 20px;">
              <table cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="50" valign="top">${logoHtml}</td>
                  <td style="padding-left: 15px;">
                    <a href="${url}" style="color: #000; text-decoration: none; font-weight: 600; font-size: 15px; line-height: 1.3;">
                      ${title}
                    </a>
                    <div style="color: #666; font-size: 13px; margin-top: 4px;">
                      ${subtitle} · Posted ${getDaysAgo(postedAt)}
                    </div>
                    <div style="color: #444; font-size: 13px; margin-top: 8px; line-height: 1.5;">
                      ${truncateDescription(description)}
                    </div>
                  </td>
                </tr>
              </table>
              <!-- Contact hidden banner -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 12px;">
                <tr>
                  <td style="background: #fef3c7; padding: 8px 12px; border-radius: 6px; font-size: 13px; color: #92400e;">
                    ⚠️ Contact info hidden — <a href="${APP_URL}/pricing?utm_source=fomo_email&utm_campaign=fomo_day3&source=email_fomo" style="color: #92400e; font-weight: 600;">upgrade to PRO</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function generateFomoEmailHtml(
  userName: string | null,
  opportunities: OpportunityForFomo[],
  jobs: JobForFomo[],
  totalCount: number,
  email: string
): string {
  const name = userName || 'there';
  const shownCount = opportunities.length + jobs.length;

  // Build project cards
  const oppCards = opportunities.map(opp => {
    const url = `${APP_URL}/freelance/${opp.slug}?utm_source=fomo_email&utm_medium=email&utm_campaign=fomo_day3`;
    const logoHtml = `<div style="width: 50px; height: 50px; background: #f97316; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #fff;">F</div>`;
    return generateFomoProjectCard(
      opp.title,
      opp.clientName + (opp.country ? ` · ${opp.country}` : ''),
      opp.description,
      opp.postedAt,
      url,
      logoHtml
    );
  }).join('');

  const jobCards = jobs.map(job => {
    const url = `${APP_URL}/company/${job.company?.slug || 'unknown'}/jobs/${job.slug}?utm_source=fomo_email&utm_medium=email&utm_campaign=fomo_day3`;
    const logoHtml = job.company?.logo
      ? `<img src="${job.company.logo}" alt="${job.company.name}" width="50" height="50" style="border-radius: 8px; object-fit: cover;">`
      : `<div style="width: 50px; height: 50px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #666;">${(job.company?.name || 'C').charAt(0)}</div>`;
    return generateFomoProjectCard(
      job.title,
      (job.company?.name || 'Unknown') + (job.country ? ` · ${job.country}` : ''),
      job.description || '',
      job.postedAt,
      url,
      logoHtml
    );
  }).join('');

  const allCards = oppCards + jobCards;
  const remainingCount = Math.max(0, totalCount - shownCount);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You missed ${totalCount} new projects this week</title>
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

          <!-- Intro -->
          <tr>
            <td style="padding: 40px 40px 20px;">
              <h2 style="margin: 0 0 20px; color: #000; font-size: 24px; font-weight: 600;">
                Hey ${name}, you're missing out
              </h2>
              <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 10px;">
                In the last 7 days, <strong>${totalCount} new projects</strong> were posted on Freelanly.
              </p>
              <p style="color: #333; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                Here are a few that could be a great fit for you:
              </p>
            </td>
          </tr>

          <!-- Project Cards -->
          ${allCards}

          ${remainingCount > 0 ? `
          <!-- Remaining count -->
          <tr>
            <td style="padding: 8px 40px 24px; text-align: center;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                And that's just ${shownCount} out of <strong>${totalCount}</strong> projects this week.
              </p>
            </td>
          </tr>
          ` : ''}

          <!-- CTA -->
          <tr>
            <td style="padding: 16px 40px 40px; text-align: center;">
              <a href="${APP_URL}/pricing?utm_source=fomo_email&utm_campaign=fomo_day3&source=email_fomo" style="display: inline-block; background: #000; color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                See all projects — €15/mo
              </a>
              <p style="margin: 20px 0 0; color: #666; font-size: 13px;">
                From €0.39/day · Cancel anytime
              </p>
            </td>
          </tr>

          <!-- P.S. -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <p style="margin: 0; color: #888; font-size: 13px; font-style: italic; line-height: 1.5;">
                P.S. Projects get taken fast. The average listing closes within 3–5 days of posting.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background: #fafafa; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
                You received this email because you signed up for Freelanly.<br>
                <a href="${APP_URL}/dashboard/settings" style="color: #666;">Manage preferences</a> ·
                <a href="${APP_URL}/dashboard/alerts" style="color: #666;">Update alerts</a>
                · <a href="${getUnsubscribeUrl(email)}" style="color: #666;">Unsubscribe</a>
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
// SENDING LOGIC
// ============================================

async function sendFomoEmail(
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, plan: true, emailVerified: true },
  });

  if (!user) return { success: false, error: 'User not found' };
  if (user.plan !== 'FREE') return { success: false, error: 'User is not FREE' };
  if (!user.emailVerified) return { success: false, error: 'Email not verified' };

  try {
    const { opportunities, jobs, totalCount } = await getProjectsForUser(userId);

    if (opportunities.length === 0 && jobs.length === 0) {
      return { success: false, error: 'No projects to show' };
    }

    const subject = `You missed ${totalCount} new projects this week 👀`;
    const html = generateFomoEmailHtml(user.name, opportunities, jobs, totalCount, user.email);

    await sendApplicationEmail({
      to: user.email,
      subject,
      html,
    });

    // Mark as sent
    await prisma.user.update({
      where: { id: userId },
      data: { fomoEmailSentAt: new Date() },
    });

    console.log(`[FOMO] Sent email to ${user.email} (${totalCount} projects)`);
    return { success: true };
  } catch (error) {
    console.error(`[FOMO] Failed to send to ${user.email}:`, error);
    return { success: false, error: String(error) };
  }
}

// ============================================
// CRON PROCESSOR
// ============================================

export async function processFomoEmails(): Promise<{
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}> {
  const now = new Date();

  // 72h ± 12h window = 60h to 84h after registration
  const windowStart = new Date(now.getTime() - 84 * 60 * 60 * 1000); // 84h ago
  const windowEnd = new Date(now.getTime() - 60 * 60 * 60 * 1000);   // 60h ago

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Find eligible FREE users in the 3-day window
  const users = await prisma.user.findMany({
    where: {
      plan: 'FREE',
      emailVerified: { not: null },
      fomoEmailSentAt: null, // Never received FOMO email
      unsubscribedFromMarketing: false,
      createdAt: {
        gte: windowStart, // Registered at least 60h ago
        lte: windowEnd,   // But no more than 84h ago
      },
    },
    select: {
      id: true,
      email: true,
    },
    take: 50, // Batch limit for Vercel timeout
  });

  console.log(`[FOMO] Processing ${users.length} eligible users (window: ${windowStart.toISOString()} to ${windowEnd.toISOString()})`);

  for (const user of users) {
    const result = await sendFomoEmail(user.id);

    if (result.success) {
      sent++;
    } else {
      if (result.error === 'No projects to show') {
        skipped++;
      } else {
        failed++;
        if (result.error) {
          errors.push(`${user.email}: ${result.error}`);
        }
      }
    }

    // Rate limit between sends
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`[FOMO] Done: sent=${sent}, failed=${failed}, skipped=${skipped}`);
  return { sent, failed, skipped, errors };
}

// ============================================
// STATS
// ============================================

export async function getFomoEmailStats(): Promise<{
  totalSent: number;
  pendingInWindow: number;
  sentLast7Days: number;
}> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 84 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() - 60 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalSent, pendingInWindow, sentLast7Days] = await Promise.all([
    prisma.user.count({
      where: { fomoEmailSentAt: { not: null } },
    }),
    prisma.user.count({
      where: {
        plan: 'FREE',
        emailVerified: { not: null },
        fomoEmailSentAt: null,
        unsubscribedFromMarketing: false,
        createdAt: { gte: windowStart, lte: windowEnd },
      },
    }),
    prisma.user.count({
      where: { fomoEmailSentAt: { gte: sevenDaysAgo } },
    }),
  ]);

  return { totalSent, pendingInWindow, sentLast7Days };
}
