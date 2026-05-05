import { prisma } from '@/lib/db';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';
import { generateCoverLetter, generateSubjectLine, generateFollowUp } from '@/services/cover-letter-generator';
import { generateTailoredResume } from '@/services/resume-pdf-generator';
import { AutoApplyStatus } from '@prisma/client';

/**
 * Process the auto-apply queue:
 * 1. Find PENDING AutoApplications
 * 2. Generate cover letters via AI
 * 3. Send via user's SMTP
 * 4. Update status
 */
export async function processAutoApplyQueue(): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  let processed = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  // Find pending applications grouped by user
  const pendingApps = await prisma.autoApplication.findMany({
    where: {
      status: AutoApplyStatus.PENDING,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          userSmtp: true,
          resumeText: true,
          parsedProfile: true,
          resumeBase64: true,
          resumeFileName: true,
        },
      },
      loop: {
        select: {
          id: true,
          dailyLimit: true,
          sentToday: true,
          lastResetAt: true,
          isActive: true,
          resumeUrl: true,
          mode: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 50, // Process in batches
  });

  if (pendingApps.length === 0) {
    console.log('[AutoApply] No pending applications in queue');
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  console.log(`[AutoApply] Processing ${pendingApps.length} pending applications`);

  for (const app of pendingApps) {
    processed++;

    // Validate user eligibility
    if (app.user.plan !== 'PRO') {
      await markFailed(app.id, 'User plan is not PRO');
      skipped++;
      continue;
    }

    if (!app.user.userSmtp?.verified) {
      await markFailed(app.id, 'SMTP not configured or not verified');
      skipped++;
      continue;
    }

    if (!app.loop.isActive) {
      await markFailed(app.id, 'Auto-apply loop is paused');
      skipped++;
      continue;
    }

    // Reset daily counter if needed
    const now = new Date();
    const lastReset = new Date(app.loop.lastResetAt);
    const isNewDay =
      now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
      now.getUTCMonth() !== lastReset.getUTCMonth() ||
      now.getUTCDate() !== lastReset.getUTCDate();

    if (isNewDay) {
      await prisma.autoApplyLoop.update({
        where: { id: app.loop.id },
        data: { sentToday: 0, lastResetAt: now },
      });
      app.loop.sentToday = 0;
    }

    // Check daily limit
    if (app.loop.sentToday >= app.loop.dailyLimit) {
      skipped++;
      continue; // Leave as PENDING, will be sent tomorrow
    }

    // SEMI mode: mark for review instead of sending
    if (app.loop.mode === 'SEMI') {
      await prisma.autoApplication.update({
        where: { id: app.id },
        data: { status: AutoApplyStatus.REVIEW },
      });
      skipped++;
      continue;
    }

    // Mark as SENDING to prevent double-processing
    await prisma.autoApplication.update({
      where: { id: app.id },
      data: { status: AutoApplyStatus.SENDING },
    });

    try {
      // Fetch job description for tailoring
      let jobDescription = '';
      if (app.jobId) {
        const job = await prisma.job.findUnique({
          where: { id: app.jobId },
          select: { description: true },
        });
        jobDescription = job?.description || '';
      } else if (app.opportunityId) {
        const opp = await prisma.opportunity.findUnique({
          where: { id: app.opportunityId },
          select: { description: true },
        });
        jobDescription = opp?.description || '';
      }

      const userProfile = {
        name: app.user.name || 'Applicant',
        skills: (app.user.parsedProfile as Record<string, unknown>)?.skills as string[] || [],
        experience: (app.user.resumeText || '').slice(0, 300),
        resumeText: app.user.resumeText || undefined,
      };

      // Generate cover letter if not already set
      let coverLetter = app.coverLetter;
      let subject = app.subject;

      if (!coverLetter || coverLetter === '') {
        coverLetter = await generateCoverLetter({
          jobTitle: app.jobTitle,
          jobDescription: jobDescription.slice(0, 800),
          companyName: app.companyName,
          userProfile,
        });
      }

      if (!subject || subject === '') {
        subject = await generateSubjectLine({
          jobTitle: app.jobTitle,
          userName: app.user.name || 'Applicant',
        });
      }

      // Generate tailored resume PDF
      let resumeAttachment: { base64: string; filename: string } | null = null;
      if (app.user.resumeText) {
        try {
          resumeAttachment = await generateTailoredResume({
            resumeText: app.user.resumeText,
            parsedProfile: app.user.parsedProfile as Record<string, unknown> | null,
            jobTitle: app.jobTitle,
            jobDescription,
          });
        } catch (e) {
          console.warn(`[AutoApply] Resume PDF generation failed for ${app.id}, sending without:`, e);
        }
      }

      // Build email HTML
      const html = buildApplicationEmailHtml({
        coverLetter,
        userName: app.user.name || 'Applicant',
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        applicationId: app.id,
      });

      const text = `${coverLetter}\n\nBest regards,\n${app.user.name || 'Applicant'}`;

      // Send via SMTP
      const smtpConfig = app.user.userSmtp!;
      const result = await sendEmailViaSMTP(
        {
          host: smtpConfig.host,
          port: smtpConfig.port,
          email: smtpConfig.email,
          password: smtpConfig.password,
        },
        {
          from: `${app.user.name || 'Applicant'} <${smtpConfig.email}>`,
          to: app.appliedToEmail,
          replyTo: smtpConfig.email,
          subject,
          html,
          text,
          resumeUrl: app.resumeUrl || app.loop.resumeUrl || undefined,
          attachmentBase64: resumeAttachment?.base64,
          attachmentFilename: resumeAttachment?.filename,
        }
      );

      if (result.success) {
        await prisma.$transaction([
          prisma.autoApplication.update({
            where: { id: app.id },
            data: {
              status: AutoApplyStatus.SENT,
              sentVia: 'smtp',
              coverLetter,
              subject,
              sentAt: now,
            },
          }),
          prisma.autoApplyLoop.update({
            where: { id: app.loop.id },
            data: {
              sentToday: { increment: 1 },
            },
          }),
        ]);
        sent++;
        console.log(`[AutoApply] Sent application ${app.id} to ${app.appliedToEmail}`);
      } else {
        await markFailed(app.id, result.error || 'SMTP send failed');
        failed++;
        console.error(`[AutoApply] Failed to send ${app.id}: ${result.error}`);
      }
    } catch (error) {
      await markFailed(app.id, String(error));
      failed++;
      console.error(`[AutoApply] Error processing ${app.id}:`, error);
    }

    // Rate limit: 500ms between sends to avoid SMTP throttling
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`[AutoApply] Done: ${sent} sent, ${failed} failed, ${skipped} skipped out of ${processed}`);

  return { processed, sent, failed, skipped };
}

/**
 * When a new Opportunity is created, match it against all active auto-apply loops
 * and create PENDING AutoApplication records.
 */
export async function queueAutoApplyForOpportunity(opportunityId: string): Promise<number> {
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: opportunityId },
    include: {
      category: { select: { slug: true } },
      company: { select: { name: true } },
    },
  });

  if (!opportunity || !opportunity.isActive || !opportunity.applyEmail) {
    return 0;
  }

  return queueAutoApplyForListing({
    type: 'opportunity',
    id: opportunity.id,
    title: opportunity.title,
    description: opportunity.description,
    companyName: opportunity.company?.name || opportunity.clientName,
    applyEmail: opportunity.applyEmail,
    categorySlug: opportunity.category.slug,
    country: opportunity.country,
    level: opportunity.level,
    skills: opportunity.skills,
  });
}

/**
 * When a new Job is created, match it against all active auto-apply loops
 * and create PENDING AutoApplication records.
 */
export async function queueAutoApplyForJob(jobId: string): Promise<number> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      category: { select: { slug: true } },
      company: { select: { name: true } },
    },
  });

  if (!job || !job.isActive || !job.applyEmail) {
    return 0;
  }

  return queueAutoApplyForListing({
    type: 'job',
    id: job.id,
    title: job.title,
    description: job.description,
    companyName: job.company.name,
    applyEmail: job.applyEmail,
    categorySlug: job.category.slug,
    country: job.country,
    level: job.level,
    skills: job.skills,
  });
}

interface ListingData {
  type: 'job' | 'opportunity';
  id: string;
  title: string;
  description: string;
  companyName: string;
  applyEmail: string;
  categorySlug: string;
  country: string | null;
  level: string;
  skills: string[];
}

/**
 * Internal: match a listing (job or opportunity) against active loops and queue applications.
 */
async function queueAutoApplyForListing(listing: ListingData): Promise<number> {
  // Find all active loops from PRO users with verified SMTP
  const activeLoops = await prisma.autoApplyLoop.findMany({
    where: {
      isActive: true,
      user: {
        plan: 'PRO',
        userSmtp: {
          verified: true,
        },
      },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (activeLoops.length === 0) {
    return 0;
  }

  let queued = 0;
  const titleLower = listing.title.toLowerCase();
  const descLower = listing.description.toLowerCase();

  for (const loop of activeLoops) {
    // Check if already applied to this listing by this user
    const existingWhere =
      listing.type === 'job'
        ? { userId_jobId: { userId: loop.userId, jobId: listing.id } }
        : { userId_opportunityId: { userId: loop.userId, opportunityId: listing.id } };

    const existing = await prisma.autoApplication.findUnique({
      where: existingWhere,
      select: { id: true },
    });

    if (existing) continue; // Deduplication: already applied

    // Match job titles — flexible: match if any significant word from loop title appears in listing title
    const titleMatch = loop.jobTitles.some((t) => {
      const loopWords = t.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !['the','and','for','with'].includes(w));
      // Match if at least half the words match OR the full title is contained
      if (titleLower.includes(t.toLowerCase())) return true;
      const matchCount = loopWords.filter(w => titleLower.includes(w)).length;
      return loopWords.length > 0 && matchCount >= Math.ceil(loopWords.length * 0.5);
    });
    if (loop.jobTitles.length > 0 && !titleMatch) continue;

    // Match keywords
    if (loop.keywords) {
      const keywords = loop.keywords
        .toLowerCase()
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k);
      const searchText = `${titleLower} ${descLower}`;
      const keywordMatch = keywords.some((kw) => searchText.includes(kw));
      if (!keywordMatch) continue;
    }

    // Match country
    if (loop.country && listing.country && loop.country !== listing.country) {
      continue;
    }

    // Match level — flexible: allow one level up or down
    if (loop.level && listing.level) {
      const levelOrder = ['INTERN','ENTRY','JUNIOR','MID','SENIOR','LEAD','MANAGER','DIRECTOR','EXECUTIVE'];
      const loopIdx = levelOrder.indexOf(loop.level);
      const listIdx = levelOrder.indexOf(listing.level);
      if (loopIdx >= 0 && listIdx >= 0 && Math.abs(loopIdx - listIdx) > 1) {
        continue; // Skip if more than 1 level apart
      }
    }

    // Check blacklisted companies
    if (
      loop.blacklistCompanies.some(
        (bc) => bc.toLowerCase() === listing.companyName.toLowerCase()
      )
    ) {
      continue;
    }

    // Determine status based on loop mode
    const status =
      loop.mode === 'SEMI'
        ? AutoApplyStatus.REVIEW
        : loop.mode === 'MANUAL'
          ? AutoApplyStatus.REVIEW
          : AutoApplyStatus.PENDING;

    // Create PENDING AutoApplication
    try {
      await prisma.autoApplication.create({
        data: {
          userId: loop.userId,
          loopId: loop.id,
          jobId: listing.type === 'job' ? listing.id : null,
          opportunityId: listing.type === 'opportunity' ? listing.id : null,
          companyName: listing.companyName,
          jobTitle: listing.title,
          appliedToEmail: listing.applyEmail,
          coverLetter: '', // Will be generated during processing
          subject: '', // Will be generated during processing
          resumeUrl: loop.resumeUrl,
          status,
        },
      });
      queued++;
    } catch (error) {
      // Unique constraint violation = already applied, skip silently
      const errorStr = String(error);
      if (!errorStr.includes('Unique constraint')) {
        console.error(`[AutoApply] Error queuing for loop ${loop.id}:`, error);
      }
    }
  }

  if (queued > 0) {
    console.log(
      `[AutoApply] Queued ${queued} applications for ${listing.type} "${listing.title}"`
    );
  }

  return queued;
}

/**
 * Mark an application as FAILED with an error message
 */
async function markFailed(id: string, errorMessage: string): Promise<void> {
  await prisma.autoApplication.update({
    where: { id },
    data: {
      status: AutoApplyStatus.FAILED,
      errorMessage: errorMessage.slice(0, 500),
    },
  });
}

/**
 * Build a clean HTML email for the application
 */
function buildApplicationEmailHtml(params: {
  coverLetter: string;
  userName: string;
  jobTitle: string;
  companyName: string;
  applicationId?: string;
}): string {
  const { coverLetter, userName, applicationId } = params;

  // Convert newlines to paragraphs
  const paragraphs = coverLetter
    .split('\n')
    .filter((p) => p.trim())
    .map((p) => `<p style="margin: 0 0 12px; line-height: 1.6;">${p}</p>`)
    .join('');

  const trackingPixel = applicationId
    ? `<img src="https://freelanly.com/api/track/auto-apply-open?id=${applicationId}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; font-size: 15px; line-height: 1.6;">
  ${paragraphs}
  <p style="margin: 24px 0 0;">Best regards,<br>${userName}</p>
  ${trackingPixel}
</body>
</html>
  `.trim();
}

/**
 * Pull-model: find recent opportunities/jobs with applyEmail
 * and match them against active auto-apply loops.
 * Creates PENDING AutoApplications for matches.
 * Called by cron every 15 min.
 */
export async function matchAndQueueAutoApplies(): Promise<number> {
  let totalQueued = 0;

  // Find recent opportunities with applyEmail (last 3 days, not already processed)
  const recentOpportunities = await prisma.opportunity.findMany({
    where: {
      isActive: true,
      applyEmail: { not: null },
      createdAt: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true },
    take: 100,
    orderBy: { createdAt: 'desc' },
  });

  for (const opp of recentOpportunities) {
    try {
      const queued = await queueAutoApplyForOpportunity(opp.id);
      totalQueued += queued;
    } catch (e) {
      console.error(`[AutoApply] Error queuing opportunity ${opp.id}:`, e);
    }
  }

  console.log(`[AutoApply] Matched ${recentOpportunities.length} opportunities, queued ${totalQueued} applications`);
  return totalQueued;
}

/**
 * Send follow-up emails for applications that were sent 3+ days ago
 * with no reply. Maximum 1 follow-up per application.
 */
export async function processFollowUps(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // Find sent/opened applications older than 3 days, no follow-up yet
  const candidates = await prisma.autoApplication.findMany({
    where: {
      status: { in: [AutoApplyStatus.SENT, AutoApplyStatus.OPENED] },
      sentAt: { lt: threeDaysAgo, not: null },
      followUpSentAt: null,
      followUpCount: 0,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          plan: true,
          userSmtp: true,
        },
      },
      loop: {
        select: {
          isActive: true,
        },
      },
    },
    take: 20,
    orderBy: { sentAt: 'asc' },
  });

  if (candidates.length === 0) return { sent: 0, failed: 0 };

  console.log(`[AutoApply] Processing ${candidates.length} follow-ups`);

  for (const app of candidates) {
    if (app.user.plan !== 'PRO' || !app.user.userSmtp?.verified || !app.loop.isActive) {
      continue;
    }

    const daysSinceSent = Math.round(
      (Date.now() - new Date(app.sentAt!).getTime()) / (24 * 60 * 60 * 1000)
    );

    try {
      const followUpBody = await generateFollowUp({
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        userName: app.user.name || 'Applicant',
        daysSinceSent,
      });

      const subject = `Re: ${app.subject}`;
      const html = buildApplicationEmailHtml({
        coverLetter: followUpBody,
        userName: app.user.name || 'Applicant',
        jobTitle: app.jobTitle,
        companyName: app.companyName,
      });
      const text = `${followUpBody}\n\nBest regards,\n${app.user.name || 'Applicant'}`;

      const smtpConfig = app.user.userSmtp!;
      const result = await sendEmailViaSMTP(
        {
          host: smtpConfig.host,
          port: smtpConfig.port,
          email: smtpConfig.email,
          password: smtpConfig.password,
        },
        {
          from: `${app.user.name || 'Applicant'} <${smtpConfig.email}>`,
          to: app.appliedToEmail,
          replyTo: smtpConfig.email,
          subject,
          html,
          text,
        }
      );

      if (result.success) {
        await prisma.autoApplication.update({
          where: { id: app.id },
          data: {
            followUpSentAt: new Date(),
            followUpCount: 1,
          },
        });
        sent++;
        console.log(`[AutoApply] Follow-up sent for ${app.id} to ${app.appliedToEmail}`);
      } else {
        failed++;
        console.error(`[AutoApply] Follow-up failed for ${app.id}: ${result.error}`);
      }
    } catch (error) {
      failed++;
      console.error(`[AutoApply] Follow-up error for ${app.id}:`, error);
    }

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (sent > 0 || failed > 0) {
    console.log(`[AutoApply] Follow-ups done: ${sent} sent, ${failed} failed`);
  }

  return { sent, failed };
}
