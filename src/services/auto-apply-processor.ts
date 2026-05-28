import { prisma } from '@/lib/db';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { generateCoverLetter, generateSubjectLine, generateFollowUp } from '@/services/cover-letter-generator';
import { fetchResumeAttachment } from '@/lib/resume-attachment';
import { AutoApplyStatus } from '@prisma/client';
import { consumeApplyQuota, refundApplyQuota } from '@/lib/apply-quota';
import { escapeHtml } from '@/lib/html-escape';
import { isScamRecipient } from '@/lib/scam-filter';
import { getRecruiterPortalUrl } from '@/lib/recruiter-token';
import { isBlockedApplyEmail } from '@/config/blocked-apply-domains';
import { parseJD, buildBreakdown, type ParsedJD } from '@/lib/match-breakdown/generate';

// Anti-spam: max emails to the same recruiter per UTC day. Used by the sender as the
// hard cap AND at match time to skip already-saturated recruiters (so we don't queue
// applications that would just be blocked and expire).
const MAX_PER_RECIPIENT_PER_DAY = 10;

// Phase 1.1 — per-user queue-depth cap. The sender drains ~20/day/user (FREE limit) and
// expires anything PENDING for >24h. Queuing more than that just creates doomed PENDING
// that expires unsent (was the dominant "FAILED" cause). Cap the backlog at one day's
// worth so we only queue what we'll actually send.
const MAX_PENDING_PER_USER = 20;

// Phase 1.3 — don't queue/send to obviously-dead recipient addresses. Catches parsing
// artifacts from LinkedIn post extraction (e.g. a phone number glued to a word like
// "9944777gone@gmail.com") and no-reply/placeholder inboxes. NOTE: free-email providers
// (gmail etc.) are kept on purpose — on freelance gigs they're the direct human client
// and actually reply MORE than corporate inboxes.
function isSendableRecipient(email: string | null | undefined): boolean {
  if (!email) return false;
  if (isScamRecipient(email)) return false; // known resume-rewrite scammers
  const e = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return false;
  const [local, domain] = e.split('@');
  const deadLocal = ['noreply', 'no-reply', 'donotreply', 'do-not-reply', 'mailer-daemon', 'postmaster', 'abuse', 'unsubscribe', 'bounce'];
  if (deadLocal.some((d) => local === d || local.startsWith(`${d}+`) || local.startsWith(`${d}-`))) return false;
  if (['example.com', 'example.org', 'test.com', 'domain.com', 'email.com'].includes(domain)) return false;
  // phone-number-like local glued to a word — a bad-extraction signature, almost never a real mailbox
  if (/^\d{5,}[a-z]+$/.test(local)) return false;
  return true;
}

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

  const MAX_PER_HOUR = 250; // Throttle: avoid IP reputation damage
  const DELAY_BETWEEN_SENDS_MS = 3000; // 3 sec between sends = ~20/min = ~1200/hr max

  // Reset sentToday for ALL loops where lastResetAt is from a previous day (including inactive)
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);
  const resetResult = await prisma.autoApplyLoop.updateMany({
    where: { lastResetAt: { lt: todayStart } },
    data: { sentToday: 0, lastResetAt: new Date() },
  });
  if (resetResult.count > 0) {
    console.log(`[AutoApply] Reset sentToday for ${resetResult.count} loops`);
  }

  // Find loops that haven't hit their daily limit yet
  const availableLoops = await prisma.autoApplyLoop.findMany({
    where: { isActive: true },
    select: { id: true, sentToday: true, dailyLimit: true },
  });
  const availableLoopIds = availableLoops
    .filter(l => l.sentToday < l.dailyLimit)
    .map(l => l.id);

  if (availableLoopIds.length === 0) {
    console.log('[AutoApply] All loops at daily limit');
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  // Hourly throttle: check how many sent in last hour
  const oneHourAgo = new Date(Date.now() - 3600000);
  const sentLastHour = await prisma.autoApplication.count({
    where: { sentAt: { gte: oneHourAgo }, status: { in: ['SENT', 'OPENED', 'REPLIED', 'INTERVIEW'] } },
  });
  const hourlyBudget = Math.max(0, MAX_PER_HOUR - sentLastHour);
  if (hourlyBudget === 0) {
    console.log(`[AutoApply] Hourly limit reached (${sentLastHour}/${MAX_PER_HOUR}), waiting`);
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  // Per-recipient limit: find recruiter emails that already got enough today
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const hotRecipients = await prisma.$queryRaw<{ appliedToEmail: string }[]>`
    SELECT "appliedToEmail" FROM "AutoApplication"
    WHERE "sentAt" >= ${today}
    GROUP BY "appliedToEmail"
    HAVING COUNT(*) >= ${MAX_PER_RECIPIENT_PER_DAY}`;
  const blockedEmails = new Set(hotRecipients.map(r => r.appliedToEmail));
  if (blockedEmails.size > 0) {
    console.log(`[AutoApply] ${blockedEmails.size} recruiter emails at daily limit (${MAX_PER_RECIPIENT_PER_DAY}/day)`);
  }

  // Expire old applications (>24h — too late, recruiter already moved on)
  const expireCutoff = new Date(Date.now() - 24 * 3600000);
  const expired = await prisma.autoApplication.updateMany({
    where: { status: { in: [AutoApplyStatus.PENDING, AutoApplyStatus.REVIEW, AutoApplyStatus.SENDING] }, createdAt: { lt: expireCutoff } },
    data: { status: 'FAILED' as any, errorMessage: 'Expired: older than 24 hours' },
  });
  if (expired.count > 0) {
    console.log(`[AutoApply] Expired ${expired.count} PENDING/REVIEW/SENDING applications older than 24h`);
  }

  const batchSize = Math.min(200, hourlyBudget);
  const pendingApps = await prisma.autoApplication.findMany({
    where: {
      status: AutoApplyStatus.PENDING,
      loopId: { in: availableLoopIds },
      createdAt: { gte: expireCutoff }, // Only fresh applications
      ...(blockedEmails.size > 0 ? { appliedToEmail: { notIn: [...blockedEmails] } } : {}),
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
          resumeUrl: true,
          resumeBase64: true,
          resumeFileName: true,
          salaryExpectation: true,
          salaryExpectationAt: true,
          workPreference: true,
          bookingUrl: true,
          caseStudies: true,
          freeAppliesUsedToday: true,
          lastFreeApplyReset: true,
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
          matchThreshold: true,
          followUpDay1: true,
          followUpDay2: true,
          followUpEnabled: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  if (pendingApps.length === 0) {
    console.log('[AutoApply] No pending applications in queue');
    return { processed: 0, sent: 0, failed: 0, skipped: 0 };
  }

  // Sort: PRO users first, then shuffle within each tier
  const proApps = pendingApps.filter(a => a.user.plan === 'PRO');
  const freeApps = pendingApps.filter(a => a.user.plan !== 'PRO');
  // Shuffle within each tier
  for (const arr of [proApps, freeApps]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  const sortedApps = [...proApps, ...freeApps];
  pendingApps.length = 0;
  pendingApps.push(...sortedApps);
  if (proApps.length > 0) console.log(`[AutoApply] Priority: ${proApps.length} PRO, ${freeApps.length} FREE`);

  console.log(`[AutoApply] Processing ${pendingApps.length} applications (hourly budget: ${hourlyBudget}, blocked recipients: ${blockedEmails.size})`);

  // Track per-recipient sends within this batch
  const recipientSendsThisBatch = new Map<string, number>();

  // Per-batch cache: parse each JD once (LLM), reuse across candidates sharing the opportunity.
  const jdCache = new Map<string, ParsedJD>();

  for (const app of pendingApps) {
    processed++;

    const hasSmtp = !!app.user.userSmtp?.verified;

    if (!app.loop.isActive) {
      await markFailed(app.id, 'Auto-apply loop is paused');
      skipped++;
      continue;
    }

    // Language check for interpreter/translator jobs (catches old PENDING apps pre-fix)
    const titleLowerSend = app.jobTitle.toLowerCase();
    if (/interpret|translat|linguist/i.test(titleLowerSend)) {
      const userProfile = app.user.parsedProfile as Record<string, unknown> | null;
      const userLangs = ((userProfile?.languages as string[]) || []).map(l => l.toLowerCase());
      const langPattern = /\b(uzbek|arabic|chinese|mandarin|cantonese|japanese|korean|thai|vietnamese|hindi|urdu|bengali|tamil|turkish|persian|farsi|russian|portuguese|french|spanish|german|italian|dutch|polish|czech|swedish|norwegian|danish|finnish|greek|hebrew|indonesian|malay|tagalog|swahili|amharic|haitian|creole|tongan|somali)\b/gi;
      const jobLangs = [...titleLowerSend.matchAll(langPattern)].map(m => m[0]);
      const nonEnglishJobLangs = jobLangs.filter(l => l !== 'english');
      if (nonEnglishJobLangs.length > 0) {
        const userKnowsLang = nonEnglishJobLangs.some(jl =>
          userLangs.some(ul => ul.includes(jl) || jl.includes(ul))
        );
        if (!userKnowsLang) {
          await markFailed(app.id, `User doesn't speak ${nonEnglishJobLangs.join(', ')}`);
          skipped++;
          continue;
        }
      }
    }

    // Global blocklist: never send to a blocked apply domain (safety net — import
    // already drops these, this covers anything already queued).
    if (isBlockedApplyEmail(app.appliedToEmail)) {
      await markFailed(app.id, 'Blocked apply domain');
      skipped++;
      continue;
    }

    // Per-recipient limit within this batch
    const recipientCount = recipientSendsThisBatch.get(app.appliedToEmail) || 0;
    if (recipientCount >= MAX_PER_RECIPIENT_PER_DAY) {
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
      continue;
    }

    // Check match threshold from loop settings
    if (app.matchScore && app.matchScore < (app.loop.matchThreshold ?? 50)) {
      skipped++;
      continue;
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
      // Fetch job description + recruiter name for tailoring
      let jobDescription = '';
      let recruiterName = '';
      if (app.jobId) {
        const job = await prisma.job.findUnique({
          where: { id: app.jobId },
          select: { description: true },
        });
        jobDescription = job?.description || '';
      } else if (app.opportunityId) {
        const opp = await prisma.opportunity.findUnique({
          where: { id: app.opportunityId },
          select: { description: true, clientName: true, clientType: true },
        });
        jobDescription = opp?.description || '';
        // clientName is the recruiter/poster name when clientType is 'profile'
        if (opp?.clientType === 'profile' && opp.clientName) {
          recruiterName = opp.clientName.split(' ')[0]; // First name
        }
      }

      const parsedProfile = app.user.parsedProfile as Record<string, unknown> | null;
      const userSkillsList = (parsedProfile?.skills as string[]) || [];
      const userLangsList = (parsedProfile?.languages as string[]) || [];

      // ── SHADOW match-breakdown: compute + freeze, but DO NOT gate (send everything). ──
      // FAIL-OPEN: any failure here must never drop a recruiter touch. Threshold is runtime
      // config; wouldGate=true means "would be CUT once enforced". We later compare reply-rate
      // of wouldGate vs passed cohorts — that (not low X/Y) proves the threshold is right.
      let matchBreakdown: Record<string, unknown> | null = null;
      try {
        if (jobDescription.trim()) {
          const jdText = `${app.jobTitle}\n${jobDescription}`;
          const jdKey = app.opportunityId || app.jobId || jdText.slice(0, 80);
          let parsed = jdCache.get(jdKey);
          const t0 = Date.now();
          if (!parsed) { parsed = await parseJD(jdText); jdCache.set(jdKey, parsed); }
          const bd = buildBreakdown(parsed, {
            jdText, cvText: app.user.resumeText || '', candidateSkills: userSkillsList, candidateLanguages: userLangsList,
            candidateYears: typeof parsedProfile?.experience_years === 'number' ? parsedProfile.experience_years as number : null,
            candidateLocation: typeof parsedProfile?.location === 'string' ? parsedProfile.location as string : null,
            candidateSalary: app.user.salaryExpectation || null,
            candidateSalaryAt: app.user.salaryExpectationAt ? app.user.salaryExpectationAt.toISOString() : null,
          });
          const ratio = bd.total ? bd.matched / bd.total : 0;
          const minMatched = Number(process.env.MATCH_GATE_MIN_MATCHED || 2);
          const minRatio = Number(process.env.MATCH_GATE_MIN_RATIO || 0.40);
          const wouldGate = bd.total === 0 ? false : !(bd.matched >= minMatched && ratio >= minRatio);
          matchBreakdown = {
            v: 1, matched: bd.matched, total: bd.total, ratio: Math.round(ratio * 100) / 100,
            wouldGate, threshold: { minMatched, minRatio }, lines: bd.lines,
            yearsContext: bd.yearsContext, locationContext: bd.locationContext, rejected: bd.rejected,
            fallback: bd.fallback, latencyMs: Date.now() - t0, shadow: true,
          };
        }
      } catch (e) {
        matchBreakdown = { error: String(e).slice(0, 200), shadow: true };
        console.error(`[AutoApply] matchBreakdown failed for ${app.id} (fail-open, sending anyway):`, e);
      }

      // Skip if profile is too sparse (no skills = likely not a real resume)
      if (userSkillsList.length === 0 && userLangsList.length === 0) {
        await markFailed(app.id, 'Profile has no skills or languages — resume may be invalid');
        skipped++;
        continue;
      }

      const userProfile = {
        name: app.user.name || 'Applicant',
        skills: userSkillsList,
        experience: (app.user.resumeText || '').slice(0, 300),
        resumeText: app.user.resumeText || undefined,
        languages: userLangsList,
        workPreference: (app.user as any).workPreference || undefined,
        bookingUrl: (app.user as any).bookingUrl || undefined,
        caseStudies: (parsedProfile?.caseStudies || (app.user as any).caseStudies) as any[] || undefined,
      };

      // Generate cover letter if not already set
      let coverLetter = app.coverLetter;
      let subject = app.subject;

      if (!coverLetter || coverLetter === '') {
        coverLetter = await generateCoverLetter({
          jobTitle: app.jobTitle,
          jobDescription: jobDescription.slice(0, 800),
          companyName: app.companyName,
          userProfile: { ...userProfile, recruiterEmail: app.appliedToEmail } as any,
        });
      }

      // Reject cover letters that admit unsuitability
      const rejectPhrases = ['cannot confirm', 'not suitable', 'no explicit', 'does not indicate', 'no relevant', 'unable to confirm', 'lack of'];
      if (coverLetter && rejectPhrases.some(p => coverLetter!.toLowerCase().includes(p))) {
        await markFailed(app.id, 'AI generated negative cover letter — profile likely doesn\'t match');
        skipped++;
        continue;
      }

      if (!subject || subject === '') {
        subject = await generateSubjectLine({
          jobTitle: app.jobTitle,
          userName: app.user.name || 'Applicant',
        });
      }

      // Attach the user's actual résumé (Blob PDF) to the application. Recruiters
      // constantly reply "send me your CV" — sending it up front cuts that round-trip.
      // null when the user has no real stored résumé (placeholder) → send without one.
      const resumeAttachment = await fetchResumeAttachment(app.user.resumeUrl, app.user.resumeFileName);

      // Build email HTML
      const html = buildApplicationEmailHtml({
        coverLetter,
        userName: app.user.name || 'Applicant',
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        recruiterName,
        applicationId: app.id,
        // Recruiter-portal footer only on apply@ (Postal) sends, not the user's own SMTP.
        recruiterEmail: hasSmtp ? undefined : app.appliedToEmail,
      });

      // AI now generates complete email with greeting + signature
      const text = coverLetter;

      // Enforce the shared FREE 20/day cap atomically before sending (PRO unlimited).
      // On the cap, return the app to PENDING so it can send after the daily reset
      // instead of being permanently failed.
      if (!(await consumeApplyQuota(app.user.id, app.user.plan))) {
        await prisma.autoApplication.update({
          where: { id: app.id },
          data: { status: AutoApplyStatus.PENDING },
        });
        skipped++;
        continue;
      }

      // Send via user's SMTP or Postal (Freelanly domain)
      let result: { success: boolean; messageId?: string; error?: string };

      if (hasSmtp) {
        // User has SMTP configured — send from their Gmail
        const smtpConfig = app.user.userSmtp!;
        const smtpArgs = [
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
          },
        ] as const;

        result = await sendEmailViaSMTP(smtpArgs[0], smtpArgs[1]);
        if (!result.success && result.error?.includes('EBUSY')) {
          await new Promise((r) => setTimeout(r, 2000));
          result = await sendEmailViaSMTP(smtpArgs[0], smtpArgs[1]);
        }
      } else {
        // No SMTP — send via Postal (Freelanly domain)
        result = await sendAutoApplyViaPostal({
          userName: app.user.name || 'Applicant',
          userEmail: app.user.email,
          to: app.appliedToEmail,
          subject,
          html,
          text,
          applicationId: app.id,
          attachmentBase64: resumeAttachment?.base64,
          attachmentFilename: resumeAttachment?.filename,
        });
      }

      if (result.success) {
        // Track first send for funnel
        if (app.loop.sentToday === 0) {
          prisma.activityLog.create({
            data: { userId: app.user.id, action: 'FUNNEL_STEP', details: { step: 'first_send_today', applicationId: app.id, company: app.companyName } },
          }).catch(() => {});
        }
        const txOps = [
          prisma.autoApplication.update({
            where: { id: app.id },
            data: {
              status: AutoApplyStatus.SENT,
              sentVia: hasSmtp ? 'smtp' : 'postal',
              coverLetter,
              subject,
              sentAt: now,
              matchBreakdown: matchBreakdown ?? undefined, // shadow: frozen, joinable to reply outcome
            },
          }),
          prisma.message.create({
            data: { applicationId: app.id, from: 'user', text: coverLetter },
          }),
          prisma.autoApplyLoop.update({
            where: { id: app.loop.id },
            data: {
              sentToday: { increment: 1 },
            },
          }),
        ];
        // (FREE quota already consumed atomically before sending — see consumeApplyQuota;
        // the old increment here had no daily reset and never enforced the 20 cap.)
        await prisma.$transaction(txOps);
        sent++;
        recipientSendsThisBatch.set(app.appliedToEmail, recipientCount + 1);
        console.log(`[AutoApply] Sent application ${app.id} to ${app.appliedToEmail}`);
      } else {
        await refundApplyQuota(app.user.id, app.user.plan); // send failed — give the slot back
        await markFailed(app.id, result.error || 'SMTP send failed');
        failed++;
        console.error(`[AutoApply] Failed to send ${app.id}: ${result.error}`);
      }
    } catch (error) {
      await markFailed(app.id, String(error));
      failed++;
      console.error(`[AutoApply] Error processing ${app.id}:`, error);
    }

    // Rate limit: 3s between sends to spread load and avoid spam flags
    await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_SENDS_MS));
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

  // Quality gate: don't auto-apply to THIN/junk posts. Skill-less generic listings
  // produce inflated AI match scores + recruiter spam (see match-scoring-fix). The
  // tier is precomputed at ingest; LIGHT/RICH still flow through.
  if (opportunity.contentQuality === 'THIN') {
    return 0;
  }

  // Use company name > posterCompany > clientName > extract from email domain
  const emailDomain = opportunity.applyEmail?.split('@')[1] || '';
  const freeEmails = ['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','aol.com','icloud.com','protonmail.com','yandex.com','zoho.com','mail.com'];
  const companyFromDomain = emailDomain && !freeEmails.includes(emailDomain)
    ? emailDomain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : '';

  const companyName = opportunity.company?.name
    || (opportunity.clientType === 'company' ? opportunity.clientName : null)
    || companyFromDomain
    || opportunity.posterCompany
    || opportunity.clientName;

  return queueAutoApplyForListing({
    type: 'opportunity',
    id: opportunity.id,
    title: opportunity.title,
    description: opportunity.description,
    companyName,
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

/**
 * Calculate match score (0-100) between user skills and listing.
 */
/**
 * AI-powered match verification for borderline cases.
 * Returns whether to apply and a refined score.
 */
export async function aiMatchCheck(
  listing: ListingData,
  userSkills: string[],
  resumeText: string,
  userName: string,
  userLanguages?: string[],
  userLocation?: string,
  userCurrentTitle?: string,
  userField?: string,
): Promise<{ shouldApply: boolean; score: number; reason: string }> {
  // Use same AI provider as cover letter generator (respects AI_PROVIDER env)
  const OpenAI = (await import('openai')).default;
  const provider = (process.env.AI_PROVIDER || 'deepseek').toLowerCase();
  const client = provider === 'zai'
    ? new OpenAI({ apiKey: process.env.ZAI_API_KEY || '', baseURL: 'https://api.z.ai/api/paas/v4', timeout: 10000 })
    : new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY || '', baseURL: 'https://api.deepseek.com/v1', timeout: 10000 });
  const model = provider === 'zai' ? 'glm-4-32b-0414-128k' : 'deepseek-chat';

  const response = await client.chat.completions.create({
    model,
    temperature: 0.1,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content: `You decide whether to auto-apply to a gig ON THE USER'S BEHALF. Applying burns the user's daily quota and emails a real recruiter — be STRICT, default to NOT applying. Return ONLY JSON: {"shouldApply": true|false, "score": 0-100, "reason": "max 10 words"}.

Evaluate IN ORDER. Failing ANY hard gate => score <=15, shouldApply=false, no matter how much else overlaps:

GATE 1 — Profession family must match. Identify the job's profession and the applicant's (from current title + field + skills). A genuinely DIFFERENT profession scores <=15 — e.g. a software developer, sales rep, marketer, engineer, hospitality/admin worker, teacher, or accountant applying to a translation/interpreting role. Generic soft skills (communication, MS Office, teamwork, project management, leadership) do NOT bridge professions. CRITICAL: merely KNOWING or SPEAKING a language — even natively, even if the language appears in the applicant's job title (e.g. "Network Engineer (Chinese Language)", a developer who lists "Hindi") — does NOT make someone a translator/interpreter. Translation/interpreting is a PROFESSION, evidenced by actual translation/interpreting/localization/subtitling/writing/proofreading work or skills — NOT a language someone happens to speak. A developer, engineer, analyst, or marketer who speaks the target language is still a DIFFERENT profession => score <=15. BUT treat translation, interpreting, localization, subtitling, transcreation, and bilingual editing/proofreading as ONE profession family: do NOT hard-gate one against another, and ignore domain qualifiers ("business", "medical", "legal", "sworn", "technical", "game") — those are domains, not different professions. Judge within-family candidates on language (GATE 2) and overlap at scoring, NOT here.

GATE 2 — Language pair (translation/interpreting/localization roles only). Find the language the job needs (e.g. "English-Chinese" -> Chinese, "German sworn" -> German). Treat the applicant's language as CONFIRMED if it appears in their title, skills, languages, or background (a "Chinese Translator" or "Spanish Medical Interpreter" obviously has it). Score <=15 ONLY when the applicant clearly works in DIFFERENT languages (e.g. a Spanish interpreter on a Chinese role; a Japanese/Chinese translator on a German role).

GATE 3 — Location: if the job is onsite or hybrid in a country different from the applicant's => score <=10. Remote = fine for anyone.

GATE 4 — Seniority: if the job needs 5+ years and the applicant is a student/intern => score low.

Only if ALL gates pass, score real skill/experience overlap:
- 80-100 (Strong): same profession + language confirmed + strong overlap.
- 60-79 (Good): same profession + language, partial overlap.
- 40-59 (Weak): same field, weak overlap.
- <=39: not a fit.
"Java" != "JavaScript". Be honest — most candidates are NOT a strong match.`,
      },
      {
        role: 'user',
        content: `JOB: ${listing.title}\nJob location: ${listing.country || 'not specified'}\nSkills needed: ${listing.skills.join(', ') || 'not specified'}\nDescription: ${listing.description.slice(0, 400)}\n\nAPPLICANT: ${userName}\nCurrent title: ${userCurrentTitle || 'not specified'}\nField: ${userField || 'not specified'}\nApplicant location: ${userLocation || 'not specified'}\nLanguages: ${userLanguages?.join(', ') || 'not specified'}\nSkills: ${userSkills.join(', ')}\nBackground: ${resumeText.slice(0, 300)}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content?.trim() || '';
  const match = content.match(/\{[\s\S]*\}/);
  if (match) {
    const parsed = JSON.parse(match[0]);
    return {
      shouldApply: !!parsed.shouldApply,
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      reason: String(parsed.reason || ''),
    };
  }
  throw new Error('AI returned invalid JSON');
}

function calculateMatchScore(
  userSkills: string[],
  listing: ListingData,
  loopTitles: string[],
  titleLower: string,
): number {
  let score = 0;

  // Skill overlap (0-60 points)
  if (userSkills.length > 0 && listing.skills.length > 0) {
    const userLower = userSkills.map(s => s.toLowerCase());
    const listLower = listing.skills.map(s => s.toLowerCase());
    const overlap = userLower.filter(us =>
      listLower.some(ls => ls.includes(us) || us.includes(ls))
    ).length;
    const skillRatio = overlap / Math.min(userSkills.length, listing.skills.length);
    score += Math.round(skillRatio * 60);
  } else {
    score += 30; // No skills to compare — neutral
  }

  // Title match (0-25 points)
  if (loopTitles.length > 0) {
    const titleMatch = loopTitles.some(t => titleLower.includes(t.toLowerCase()));
    if (titleMatch) score += 25;
    else {
      const partialMatch = loopTitles.some(t => {
        const words = t.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const matched = words.filter(w => titleLower.includes(w)).length;
        return words.length > 0 && matched >= Math.ceil(words.length * 0.5);
      });
      if (partialMatch) score += 15;
    }
  } else {
    score += 15;
  }

  // Level/country match bonus (0-15 points)
  score += 10; // Base for getting through all filters
  if (listing.skills.length >= 3) score += 5; // Rich listing

  return Math.min(100, score);
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
// Cache AI match results per listing+skills combo (within one run)
const aiMatchCache = new Map<string, { shouldApply: boolean; score: number; reason: string }>();

async function queueAutoApplyForListing(listing: ListingData): Promise<number> {
  // Phase 1.3: skip listings whose apply address is dead/garbage — sending there is pure waste.
  if (!isSendableRecipient(listing.applyEmail)) {
    return 0;
  }

  // Find all active loops from users with verified SMTP
  const activeLoops = await prisma.autoApplyLoop.findMany({
    where: {
      isActive: true,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          parsedProfile: true,
          resumeText: true,
          workPreference: true,
          bookingUrl: true,
          caseStudies: true,
        },
      },
    },
  });

  if (activeLoops.length === 0) {
    return 0;
  }

  // Fan-out cap: limit how many of OUR users apply to a single listing. Generic/viral
  // posts otherwise pull hundreds of applicants — recruiter spam, burns user quota, and
  // makes match runs take ~a day. Counts across runs; the early break below also stops
  // wasteful AI match evaluations once the budget is spent.
  const FANOUT_CAP = 30;
  const existingForListing = await prisma.autoApplication.count({
    where: listing.type === 'job' ? { jobId: listing.id } : { opportunityId: listing.id },
  });
  if (existingForListing >= FANOUT_CAP) {
    return 0;
  }
  const fanoutBudget = FANOUT_CAP - existingForListing;

  // Phase 1.1: current PENDING backlog per candidate user (one grouped query, not N).
  // Used below to skip users whose queue is already a full day's worth of sends.
  const pendingByUser = new Map<string, number>();
  {
    const groups = await prisma.autoApplication.groupBy({
      by: ['userId'],
      where: { userId: { in: activeLoops.map((l) => l.userId) }, status: AutoApplyStatus.PENDING },
      _count: { _all: true },
    });
    for (const g of groups) pendingByUser.set(g.userId, g._count._all);
  }

  // Skip recruiters already at/near their daily send cap. The sender caps each recruiter
  // at MAX_PER_RECIPIENT_PER_DAY/day; queuing beyond that just creates PENDING that gets
  // blocked and expires (was ~89% of all expirations). "Load" = sent today + still-pending
  // to this recruiter (pending will consume the cap too). This also diversifies: once a
  // recruiter is full, matching users flow to other (un-saturated) recruiters instead.
  const startOfDayUTC = new Date(); startOfDayUTC.setUTCHours(0, 0, 0, 0);
  const recipientLoad = await prisma.autoApplication.count({
    where: {
      appliedToEmail: listing.applyEmail,
      OR: [
        { status: AutoApplyStatus.PENDING },
        { sentAt: { gte: startOfDayUTC } },
      ],
    },
  });
  const recipientHeadroom = MAX_PER_RECIPIENT_PER_DAY - recipientLoad;
  if (recipientHeadroom <= 0) {
    return 0; // recruiter saturated — don't queue applications that would just expire
  }

  // Never queue more than the recruiter can actually receive today.
  const budget = Math.min(fanoutBudget, recipientHeadroom);

  // FAIRNESS: a listing's slots are scarce (budget) but many loops match. Without an order,
  // loops were taken in arbitrary DB order, so the SAME users won contested slots run after
  // run while others' apps queued then expired (measured: ~245 active loops sent 0 in 7d
  // DESPITE matching — every one of their queued apps expired). Order the matching loops
  // LEAST-SERVED-FIRST (fewest sends in the last 7d) so the scarce slots rotate to the
  // starved instead of the same winners. Random tie-break so equal-served users don't
  // re-acquire a fixed order. The match threshold below still gates quality; this only
  // decides WHO among qualified candidates gets the limited slots. Distribution lever, not
  // volume — total sends are unchanged, they're just shared fairly.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const sentRecentlyByUser = new Map<string, number>();
  {
    const groups = await prisma.autoApplication.groupBy({
      by: ['userId'],
      where: { userId: { in: activeLoops.map((l) => l.userId) }, sentAt: { gte: sevenDaysAgo, not: null } },
      _count: { _all: true },
    });
    for (const g of groups) sentRecentlyByUser.set(g.userId, g._count._all);
  }
  activeLoops.sort((a, b) => {
    const d = (sentRecentlyByUser.get(a.userId) || 0) - (sentRecentlyByUser.get(b.userId) || 0);
    return d !== 0 ? d : Math.random() - 0.5;
  });

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

    if (existing) continue; // Deduplication: already applied to this exact listing

    // Deduplication: skip if already applied to same recruiter email for similar job title
    const alreadySentToRecruiter = await prisma.autoApplication.findFirst({
      where: {
        userId: loop.userId,
        appliedToEmail: listing.applyEmail,
        jobTitle: { equals: listing.title, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (alreadySentToRecruiter) continue;

    // Check blacklisted companies
    if (
      loop.blacklistCompanies.some(
        (bc) => bc.toLowerCase() === listing.companyName.toLowerCase()
      )
    ) {
      continue;
    }

    // Exclude keywords — skip if any excluded keyword found in title or description
    if (loop.excludeKeywords) {
      const excludes = loop.excludeKeywords
        .toLowerCase()
        .split(',')
        .map((k) => k.trim())
        .filter((k) => k);
      const searchText = `${titleLower} ${descLower}`;
      const hasExcluded = excludes.some((ex) => searchText.includes(ex));
      if (hasExcluded) continue;
    }

    // Phase 1.1: don't queue past the user's drainable backlog — extra PENDING just
    // expires unsent. Checked before the AI match call, so it also saves AI evals.
    if ((pendingByUser.get(loop.userId) || 0) >= MAX_PENDING_PER_USER) {
      continue;
    }

    const userProfile = loop.user.parsedProfile as Record<string, unknown> | null;
    const userSkills = (userProfile?.skills as string[]) || [];
    const userLangsList = (userProfile?.languages as string[]) || [];

    // Skip invalid/sparse profiles at MATCH time (no skills + no languages = not a real
    // resume). Previously this was only caught at send time after wasting a queue slot,
    // an AI match call and a generated cover letter — the dominant non-expiry FAILED cause.
    if (userSkills.length === 0 && userLangsList.length === 0) {
      continue;
    }

    // AI matching — AI decides if user is a good match (skills, role, location, language)
    let matchScore = 0;
    let matchLabel = 'Weak';
    {
      const userLoc = (userProfile?.location as string) || undefined;
      const userTitle = (userProfile?.current_title as string) || '';
      const userField = (userProfile?.field as string) || '';
      const skillHash = userSkills.slice(0, 5).sort().join(',') + ':' + (userLoc || '') + ':' + userTitle;
      const cacheKey = `${listing.id}:${skillHash}`;
      let aiResult = aiMatchCache.get(cacheKey);

      if (!aiResult) {
        try {
          const userLangs = (userProfile?.languages as string[]) || undefined;
          aiResult = await aiMatchCheck(listing, userSkills, (loop.user as any).resumeText || '', (loop.user as any).name || 'Applicant', userLangs, userLoc, userTitle, userField);
          aiMatchCache.set(cacheKey, aiResult);
        } catch {
          aiResult = null;
        }
      }

      if (aiResult) {
        if (!aiResult.shouldApply) continue;
        matchScore = aiResult.score;
        matchLabel = matchScore >= 80 ? 'Strong' : matchScore >= 50 ? 'Good' : 'Weak';
      } else {
        continue; // AI failed — skip rather than send bad match
      }
    }

    // Determine status based on loop mode
    const status =
      loop.mode === 'SEMI'
        ? AutoApplyStatus.REVIEW
        : loop.mode === 'MANUAL'
          ? AutoApplyStatus.REVIEW
          : AutoApplyStatus.PENDING;

    // Resolve real company name from email domain (portals like CyberJob.az post for other companies)
    const FREE_EMAILS = ['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','aol.com','icloud.com','protonmail.com','proton.me','yandex.com','zoho.com','mail.com','zohomail.com','zohomail.in'];
    const emailDomain = listing.applyEmail.split('@')[1]?.toLowerCase() || '';
    const companyFromDomain = emailDomain && !FREE_EMAILS.includes(emailDomain)
      ? emailDomain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : '';
    // Use domain-derived name if it differs significantly from listing companyName (portal detection)
    const listedNameLower = listing.companyName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const domainNameLower = companyFromDomain.toLowerCase().replace(/[^a-z0-9]/g, '');
    const realCompanyName = (companyFromDomain && domainNameLower && !listedNameLower.includes(domainNameLower) && !domainNameLower.includes(listedNameLower))
      ? companyFromDomain
      : listing.companyName;

    // Generate cover letter + subject at queue time
    let coverLetter = '';
    let subject = '';
    try {
      const parsedProfile = loop.user.parsedProfile as Record<string, unknown> | null;
      // Phase 2.4: feed the generator the full profile (was just 300 chars → generic letters).
      const userProfile = {
        name: loop.user.name || 'Applicant',
        skills: (parsedProfile?.skills as string[]) || [],
        experience: (parsedProfile?.experience as string) || loop.user.resumeText?.slice(0, 1500) || '',
        resumeText: loop.user.resumeText || undefined,
        languages: (parsedProfile?.languages as string[]) || undefined,
        workPreference: loop.user.workPreference || undefined,
        bookingUrl: loop.user.bookingUrl || undefined,
        caseStudies: (parsedProfile?.caseStudies || loop.user.caseStudies) as any[] || undefined,
        recruiterEmail: listing.applyEmail,
      };
      [coverLetter, subject] = await Promise.all([
        generateCoverLetter({
          jobTitle: listing.title,
          jobDescription: listing.description.slice(0, 800),
          companyName: realCompanyName,
          userProfile,
        }),
        generateSubjectLine({ jobTitle: listing.title, userName: loop.user.name || 'Applicant' }),
      ]);
    } catch (e) {
      console.error(`[AutoApply] Failed to pre-generate cover letter for ${listing.title}:`, e);
    }

    // Create PENDING AutoApplication
    try {
      await prisma.autoApplication.create({
        data: {
          userId: loop.userId,
          loopId: loop.id,
          jobId: listing.type === 'job' ? listing.id : null,
          opportunityId: listing.type === 'opportunity' ? listing.id : null,
          companyName: realCompanyName,
          jobTitle: listing.title,
          appliedToEmail: listing.applyEmail,
          matchScore,
          matchLabel,
          coverLetter,
          subject,
          resumeUrl: loop.resumeUrl,
          status,
        },
      });
      queued++;
      pendingByUser.set(loop.userId, (pendingByUser.get(loop.userId) || 0) + 1);
      if (queued >= budget) break; // hit fan-out or recruiter-capacity budget
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
export function buildApplicationEmailHtml(params: {
  coverLetter: string;
  userName: string;
  jobTitle: string;
  companyName: string;
  recruiterName?: string;
  applicationId?: string;
  /** When set, append a subtle "see all your candidates" footer linking to the recruiter
   *  portal (/r/[token]). Pass ONLY for Postal (apply@) sends — not for a candidate's own
   *  SMTP, where a Freelanly footer would be out of place. */
  recruiterEmail?: string;
}): string {
  const { coverLetter, userName, jobTitle, applicationId, recruiterEmail } = params;
  const portalUrl = recruiterEmail ? getRecruiterPortalUrl(recruiterEmail) : '';

  // Convert newlines to paragraphs (escape content — AI/scraped text must not inject HTML)
  const paragraphs = coverLetter
    .split('\n')
    .filter((p) => p.trim())
    .map((p) => `<p style="margin: 0 0 12px; line-height: 1.6;">${escapeHtml(p)}</p>`)
    .join('');

  // Prominent top banner — frames the portal as the recruiter's candidate inbox so they
  // reply/review there (where we can build paywall + tracking) instead of plain email reply.
  // Email reply still works (Reply-To unchanged) — this is a soft nudge, no forced redirect.
  const portalBanner = recruiterEmail
    ? `<table role="presentation" width="100%" style="margin: 0 0 22px; border-collapse: collapse;">
    <tr><td style="background: #F4F8E8; border: 1px solid #C7F94A; border-radius: 12px; padding: 16px 20px;">
      <div style="font-size: 14px; font-weight: 700; color: #0B0C0F; margin-bottom: 3px;">New applicant for ${escapeHtml(jobTitle)}</div>
      <div style="font-size: 13px; color: #555; line-height: 1.5; margin-bottom: 13px;">Reply, view their CV, and manage everyone who applied to your roles — all in one place.</div>
      <a href="${portalUrl}" style="display: inline-block; padding: 10px 24px; background: #0B0C0F; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">Open your candidates &amp; reply &rarr;</a>
    </td></tr>
  </table>`
    : '';

  const portalCta = recruiterEmail
    ? `<table role="presentation" width="100%" style="margin-top: 26px; border-collapse: collapse;">
    <tr><td style="padding: 22px 0 4px; border-top: 1px solid #ebe9e3; text-align: center;">
      <div style="font-size: 15px; font-weight: 600; color: #0B0C0F; margin-bottom: 4px;">${escapeHtml(userName)} and your other candidates are in one place</div>
      <div style="font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 16px;">View profiles &amp; CVs and reply to everyone who applied to your roles.</div>
      <a href="${portalUrl}" style="display: inline-block; padding: 13px 32px; background: #C7F94A; color: #000; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 15px;">View candidates &amp; reply &rarr;</a>
      <div style="font-size: 11px; color: #9a9a9a; margin-top: 16px;">via Freelanly</div>
    </td></tr>
  </table>`
    : '';

  const trackingPixel = applicationId
    ? `<img src="https://freelanly.com/api/track/auto-apply-open?id=${applicationId}" width="1" height="1" style="display:block;width:1px;height:1px;border:0;" alt="" />`
    : '';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; font-size: 15px; line-height: 1.6;">
  ${portalBanner}
  ${paragraphs}
  ${portalCta}
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
