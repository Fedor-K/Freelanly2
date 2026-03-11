/**
 * Nurture Email Service
 * Sends follow-up emails to FREE users who tried to apply but haven't upgraded
 */

import { prisma } from '@/lib/db';
import { sendApplicationEmail } from '@/lib/email';
import { siteConfig } from '@/config/site';
import { getUnsubscribeUrl } from '@/lib/unsubscribe';

interface NurtureStats {
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Send nurture email immediately for a specific apply attempt
 * Called directly when user hits the paywall
 */
export async function sendNurtureEmailForAttempt(attemptId: string): Promise<boolean> {
  try {
    const attempt = await prisma.applyAttempt.findUnique({
      where: { id: attemptId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            plan: true,
            unsubscribedFromMarketing: true,
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
        opportunity: {
          select: {
            id: true,
            title: true,
            slug: true,
            clientName: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
          },
        },
      },
    });

    if (!attempt) {
      console.error('[Nurture] Attempt not found:', attemptId);
      return false;
    }

    // Skip if user is PRO
    if (attempt.user.plan !== 'FREE') {
      return false;
    }

    // Skip if user has unsubscribed from marketing emails
    if (attempt.user.unsubscribedFromMarketing) {
      return false;
    }

    // Resolve job or opportunity
    const isOpportunity = !!attempt.opportunity;
    const title = isOpportunity ? attempt.opportunity!.title : attempt.job?.title || 'this job';
    const company = isOpportunity ? attempt.opportunity!.clientName : attempt.job?.company?.name || 'the company';
    const itemId = isOpportunity ? attempt.opportunity!.id : attempt.job?.id || '';
    const itemUrl = isOpportunity
      ? `${siteConfig.url}/freelance/${attempt.opportunity!.slug}`
      : `${siteConfig.url}/company/${attempt.job!.company.slug}/jobs/${attempt.job!.slug}`;

    const rawSalary = isOpportunity ? attempt.opportunity!.salaryMin : attempt.job?.salaryMin;
    const rawSalaryMax = isOpportunity ? attempt.opportunity!.salaryMax : attempt.job?.salaryMax;
    const currency = isOpportunity ? attempt.opportunity!.salaryCurrency : attempt.job?.salaryCurrency;
    const salaryText = rawSalary && rawSalaryMax
      ? `${currency || '$'}${(rawSalary / 1000).toFixed(0)}K - ${(rawSalaryMax / 1000).toFixed(0)}K`
      : rawSalary ? `From ${currency || '$'}${(rawSalary / 1000).toFixed(0)}K` : 'Competitive salary';

    // A/B variant by userId (stable assignment, no DB needed)
    const variantIndex = parseInt(attempt.userId.slice(-2), 16) % 3;
    const variant = (['A', 'B', 'C'] as const)[variantIndex];

    const pricingUrl = `${siteConfig.url}/pricing?utm_source=nurture&utm_medium=email&utm_variant=${variant}&source=email_nurture&${isOpportunity ? 'opportunityId' : 'jobId'}=${itemId}`;

    const html = generateNurtureEmailHtml({
      userName: attempt.user.name || 'there',
      jobTitle: title,
      companyName: company,
      salary: salaryText,
      jobUrl: itemUrl,
      pricingUrl,
      isImmediate: true,
      email: attempt.user.email,
      variant,
    });

    const subjectByVariant = {
      A: `You tried to apply to "${title}" — here's how`,
      B: `Someone else is applying to "${title}" right now`,
      C: `"${title}" at ${company} — contact info is one step away`,
    };
    const subject = subjectByVariant[variant];

    const result = await sendApplicationEmail({
      to: attempt.user.email,
      subject,
      html,
    });

    if (result.success) {
      await prisma.applyAttempt.update({
        where: { id: attemptId },
        data: {
          nurtureEmailSent: true,
          nurtureEmailSentAt: new Date(),
        },
      });
      console.log(`[Nurture] Email sent to ${attempt.user.email} for job ${attempt.job.title}`);
      return true;
    } else {
      console.error(`[Nurture] Failed to send email to ${attempt.user.email}:`, result.error);
      return false;
    }
  } catch (error) {
    console.error('[Nurture] Error sending immediate email:', error);
    return false;
  }
}

/**
 * Send nurture emails to users who tried to apply in the last 1-24 hours
 * and haven't received a nurture email yet (CRON FALLBACK)
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
        user: {
          unsubscribedFromMarketing: false, // Respect unsubscribe preference
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
        opportunity: {
          select: {
            id: true,
            title: true,
            slug: true,
            clientName: true,
            salaryMin: true,
            salaryMax: true,
            salaryCurrency: true,
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

        // Resolve job or opportunity
        const isOpportunity = !!attempt.opportunity;
        const title = isOpportunity ? attempt.opportunity!.title : attempt.job?.title || 'this job';
        const company = isOpportunity ? attempt.opportunity!.clientName : attempt.job?.company?.name || 'the company';
        const itemId = isOpportunity ? attempt.opportunity!.id : attempt.job?.id || '';
        const itemUrl = isOpportunity
          ? `${siteConfig.url}/freelance/${attempt.opportunity!.slug}`
          : `${siteConfig.url}/company/${attempt.job!.company.slug}/jobs/${attempt.job!.slug}`;

        const rawSalary = isOpportunity ? attempt.opportunity!.salaryMin : attempt.job?.salaryMin;
        const rawSalaryMax = isOpportunity ? attempt.opportunity!.salaryMax : attempt.job?.salaryMax;
        const currency = isOpportunity ? attempt.opportunity!.salaryCurrency : attempt.job?.salaryCurrency;
        const salaryText = rawSalary && rawSalaryMax
          ? `${currency || '$'}${(rawSalary / 1000).toFixed(0)}K - ${(rawSalaryMax / 1000).toFixed(0)}K`
          : rawSalary ? `From ${currency || '$'}${(rawSalary / 1000).toFixed(0)}K` : 'Competitive salary';

        const variantIndex = parseInt(attempt.userId.slice(-2), 16) % 3;
        const variant = (['A', 'B', 'C'] as const)[variantIndex];
        const pricingUrl = `${siteConfig.url}/pricing?utm_source=nurture&utm_medium=email&utm_variant=${variant}&source=email_nurture&${isOpportunity ? 'opportunityId' : 'jobId'}=${itemId}`;

        const html = generateNurtureEmailHtml({
          userName: attempt.user.name || 'there',
          jobTitle: title,
          companyName: company,
          salary: salaryText,
          jobUrl: itemUrl,
          pricingUrl,
          email: attempt.user.email,
          variant,
        });

        const subjectByVariant = {
          A: `You tried to apply to "${title}" — here's how`,
          B: `Someone else is applying to "${title}" right now`,
          C: `"${title}" at ${company} — contact info is one step away`,
        };
        const subject = subjectByVariant[variant];

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
  isImmediate?: boolean;
  email: string;
  variant?: 'A' | 'B' | 'C';
}): string {
  const v = params.variant || 'A';

  // Variant copy
  const headlines = {
    A: `Hey ${params.userName}, you're one step away`,
    B: `${params.userName}, don't let others get there first`,
    C: `The contact info for this job is waiting for you`,
  };
  const intros = {
    A: `You tried to apply to <strong>${params.jobTitle}</strong> at ${params.companyName}. The direct contact info is right there — you just need PRO to see it.`,
    B: `While you're reading this, PRO members are emailing the hiring manager at ${params.companyName} directly for <strong>${params.jobTitle}</strong>. You found the job first.`,
    C: `You found <strong>${params.jobTitle}</strong> at ${params.companyName}. Behind the paywall: their direct email, LinkedIn, and full salary breakdown.`,
  };
  const ctaLabels = {
    A: 'Unlock & Apply Now →',
    B: 'Get Ahead — Upgrade to PRO →',
    C: 'See Contact Info & Apply →',
  };

  const headerText = headlines[v];
  const introText = intros[v];
  const ctaLabel = ctaLabels[v];

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
    <h1>${headerText}</h1>

    <p>${introText}</p>

    <div class="job-card">
      <div class="job-title">${params.jobTitle}</div>
      <div class="job-meta">${params.companyName} • Remote</div>
      <div class="salary">${params.salary}</div>
    </div>

    <div class="urgency">
      ⏰ Remote jobs get 50–200 applications in the first week. Apply early.
    </div>

    <p style="text-align: center;">
      <a href="${params.pricingUrl}" class="cta">${ctaLabel}</a>
    </p>

    <div class="benefits">
      <p style="font-weight: 600; margin-bottom: 12px;">With Premium you get:</p>
      <div class="benefit"><span class="check">✓</span> Apply to unlimited jobs directly</div>
      <div class="benefit"><span class="check">✓</span> See direct contact info (emails, phones)</div>
      <div class="benefit"><span class="check">✓</span> Full salary insights with market data</div>
      <div class="benefit"><span class="check">✓</span> Cancel anytime, no commitment</div>
    </div>

    <p style="text-align: center;">
      <a href="${params.jobUrl}" style="color: #666; font-size: 14px;">View job details →</a>
    </p>

    <div class="footer">
      <p>You're receiving this because you tried to apply to a job on Freelanly.</p>
      <p><a href="${params.pricingUrl}">Upgrade to PRO</a> or <a href="https://freelanly.com/dashboard/settings">manage your email preferences</a>.</p>
      <p><a href="https://freelanly.com/dashboard/alerts" style="color: #666;">Manage job alerts</a> | <a href="${getUnsubscribeUrl(params.email)}" style="color: #666;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
