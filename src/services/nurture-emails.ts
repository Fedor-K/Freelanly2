/**
 * Nurture Email Service
 * Sends follow-up emails to FREE users who tried to apply but haven't upgraded
 */

import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/dashamail';
import { siteConfig } from '@/config/site';

interface NurtureStats {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Send nurture emails to users who tried to apply in the last 1-24 hours
 * and haven't received a nurture email yet
 */
export async function sendNurtureEmails(): Promise<NurtureStats> {
  const stats: NurtureStats = {
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Find apply attempts from 1-24 hours ago that haven't been nurtured
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const attempts = await prisma.applyAttempt.findMany({
      where: {
        nurtureEmailSent: false,
        converted: false,
        createdAt: {
          gte: oneDayAgo,
          lte: oneHourAgo, // Wait at least 1 hour before sending
        },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            slug: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
            company: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
      },
      take: 50, // Process in batches
    });

    console.log(`[Nurture] Found ${attempts.length} attempts to nurture`);

    for (const attempt of attempts) {
      try {
        // Skip if user already upgraded
        if (attempt.user.plan !== 'FREE') {
          await prisma.applyAttempt.update({
            where: { id: attempt.id },
            data: { converted: true, convertedAt: new Date() },
          });
          stats.skipped++;
          continue;
        }

        // Generate email content
        const jobUrl = `${siteConfig.url}/company/${attempt.job.company.slug}/jobs/${attempt.job.slug}`;
        const pricingUrl = `${siteConfig.url}/pricing?utm_source=nurture&utm_medium=email&job=${attempt.job.id}`;

        const salaryText = attempt.job.salaryMin && attempt.job.salaryMax
          ? `${attempt.job.salaryCurrency || '$'}${(attempt.job.salaryMin / 1000).toFixed(0)}K - ${attempt.job.salaryCurrency || '$'}${(attempt.job.salaryMax / 1000).toFixed(0)}K`
          : 'Competitive salary';

        const html = generateNurtureEmailHtml({
          userName: attempt.user.name || 'there',
          jobTitle: attempt.job.title,
          companyName: attempt.job.company.name,
          salary: salaryText,
          jobUrl,
          pricingUrl,
        });

        const subject = `You tried to apply to "${attempt.job.title}" at ${attempt.job.company.name}`;

        const result = await sendApplicationEmail({
          to: attempt.user.email,
          subject,
          html,
        });

        if (result.success) {
          await prisma.applyAttempt.update({
            where: { id: attempt.id },
            data: {
              nurtureEmailSent: true,
              nurtureEmailSentAt: new Date(),
            },
          });
          stats.sent++;
        } else {
          stats.failed++;
          stats.errors.push(`${attempt.user.email}: ${result.error}`);
        }

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        stats.failed++;
        stats.errors.push(`${attempt.id}: ${String(error)}`);
      }
    }

    return stats;
  } catch (error) {
    console.error('[Nurture] Error:', error);
    stats.errors.push(String(error));
    return stats;
  }
}

function generateNurtureEmailHtml(params: {
  userName: string;
  jobTitle: string;
  companyName: string;
  salary: string;
  jobUrl: string;
  pricingUrl: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 560px; margin: 0 auto; padding: 32px 20px; }
    h1 { font-size: 22px; margin: 0 0 16px 0; }
    p { margin: 0 0 16px 0; }
    .job-card { background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .job-title { font-size: 18px; font-weight: 600; margin: 0 0 8px 0; }
    .job-meta { color: #666; font-size: 14px; }
    .salary { color: #059669; font-weight: 600; }
    .cta { display: inline-block; background: #000; color: #fff !important; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 8px 0; }
    .benefits { margin: 24px 0; }
    .benefit { display: flex; align-items: center; gap: 8px; margin: 8px 0; font-size: 14px; }
    .check { color: #059669; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 32px; font-size: 12px; color: #666; }
    .urgency { background: #fef3c7; border-radius: 6px; padding: 12px; margin: 16px 0; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hey ${params.userName}!</h1>

    <p>You found a great opportunity yesterday but couldn't apply. The job is still open:</p>

    <div class="job-card">
      <div class="job-title">${params.jobTitle}</div>
      <div class="job-meta">${params.companyName} • Remote</div>
      <div class="salary">${params.salary}</div>
    </div>

    <div class="urgency">
      ⏰ Good jobs get filled fast. Don't miss this one.
    </div>

    <p style="text-align: center;">
      <a href="${params.pricingUrl}" class="cta">Unlock This Application →</a>
    </p>

    <div class="benefits">
      <p style="font-weight: 600; margin-bottom: 12px;">With Premium you get:</p>
      <div class="benefit"><span class="check">✓</span> Apply to unlimited jobs directly</div>
      <div class="benefit"><span class="check">✓</span> See direct contact info (emails, phones)</div>
      <div class="benefit"><span class="check">✓</span> Full salary insights with market data</div>
      <div class="benefit"><span class="check">✓</span> 7-day free trial, cancel anytime</div>
    </div>

    <p style="text-align: center;">
      <a href="${params.jobUrl}" style="color: #666; font-size: 14px;">View job details →</a>
    </p>

    <div class="footer">
      <p>You're receiving this because you tried to apply to a job on Freelanly.</p>
      <p><a href="${params.pricingUrl}">Start your free trial</a> or <a href="https://freelanly.com/dashboard/settings">manage your email preferences</a>.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
