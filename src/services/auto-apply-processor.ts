import { prisma } from '@/lib/db';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
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

  const MAX_PER_RECIPIENT_PER_DAY = 10; // Anti-spam: max emails to same recruiter
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
          resumeBase64: true,
          resumeFileName: true,
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

      // Generate tailored resume PDF — DISABLED until design is ready
      // TODO: re-enable once designer delivers HTML template
      const resumeAttachment: { base64: string; filename: string } | null = null;

      // Build email HTML
      const html = buildApplicationEmailHtml({
        coverLetter,
        userName: app.user.name || 'Applicant',
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        recruiterName,
        applicationId: app.id,
      });

      // AI now generates complete email with greeting + signature
      const text = coverLetter;

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
        // TODO: attach tailored resume PDF once design is ready
        result = await sendAutoApplyViaPostal({
          userName: app.user.name || 'Applicant',
          userEmail: app.user.email,
          to: app.appliedToEmail,
          subject,
          html,
          text,
          applicationId: app.id,
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
        // Increment free applies counter for FREE users
        if (app.user.plan === 'FREE') {
          txOps.push(
            prisma.user.update({
              where: { id: app.user.id },
              data: { freeAppliesUsedToday: { increment: 1 } },
            })
          );
        }
        await prisma.$transaction(txOps);
        sent++;
        recipientSendsThisBatch.set(app.appliedToEmail, recipientCount + 1);
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
async function aiMatchCheck(
  listing: ListingData,
  userSkills: string[],
  resumeText: string,
  userName: string,
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
    max_tokens: 100,
    messages: [
      {
        role: 'system',
        content: `You evaluate if a job applicant is a good match for a role. Return ONLY valid JSON: {"shouldApply": true/false, "score": 0-100, "reason": "one sentence"}

Rules:
- score 70+: skills overlap well, should apply
- score 40-69: partial match, some transferable skills
- score <40: poor match, don't waste the send
- If job requires 5+ years and applicant is a student/intern → score low
- If job requires specific tech (Golang, Rust) that applicant doesn't have → score low
- "Java" and "JavaScript" are DIFFERENT technologies`,
      },
      {
        role: 'user',
        content: `JOB: ${listing.title}\nSkills needed: ${listing.skills.join(', ')}\nDescription: ${listing.description.slice(0, 300)}\n\nAPPLICANT: ${userName}\nSkills: ${userSkills.join(', ')}\nBackground: ${resumeText.slice(0, 200)}`,
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

    // Skills matching — skip if user profile has skills and overlap is too low
    const userProfile = loop.user.parsedProfile as Record<string, unknown> | null;
    const userSkills = (userProfile?.skills as string[]) || [];
    if (userSkills.length > 0 && listing.skills.length > 0) {
      const userSkillsLower = userSkills.map(s => s.toLowerCase());
      const listingSkillsLower = listing.skills.map(s => s.toLowerCase());

      // Check if any user skill appears in listing skills or listing title/description
      const skillOverlap = userSkillsLower.filter(us =>
        listingSkillsLower.some(ls => ls.includes(us) || us.includes(ls)) ||
        titleLower.includes(us) || descLower.includes(us)
      ).length;

      // Require at least 1 matching skill
      if (skillOverlap === 0) {
        continue;
      }
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

    // Language check for interpreter/translator jobs
    const isLanguageJob = /interpret|translat|linguist/i.test(titleLower);
    if (isLanguageJob) {
      const userLangs = ((userProfile?.languages as string[]) || []).map(l => l.toLowerCase());
      // Extract language from title (e.g. "Uzbek-English" → ["uzbek", "english"])
      const langPattern = /\b(uzbek|arabic|chinese|mandarin|cantonese|japanese|korean|thai|vietnamese|hindi|urdu|bengali|tamil|turkish|persian|farsi|russian|portuguese|french|spanish|german|italian|dutch|polish|czech|swedish|norwegian|danish|finnish|greek|hebrew|indonesian|malay|tagalog|swahili|amharic|haitian|creole|tongan|somali)\b/gi;
      const jobLangs = [...titleLower.matchAll(langPattern)].map(m => m[0]);
      // If job requires specific languages, user must know at least one non-English
      const nonEnglishJobLangs = jobLangs.filter(l => l !== 'english');
      if (nonEnglishJobLangs.length > 0) {
        const userKnowsLang = nonEnglishJobLangs.some(jl =>
          userLangs.some(ul => ul.includes(jl) || jl.includes(ul))
        );
        if (!userKnowsLang) {
          continue; // User doesn't speak the required language
        }
      }
    }

    // Calculate rough match score
    let matchScore = calculateMatchScore(userSkills, listing, loop.jobTitles, titleLower);
    let matchLabel = matchScore >= 80 ? 'Strong' : matchScore >= 50 ? 'Good' : 'Weak';

    // Skip obvious mismatches
    if (matchScore < 30) {
      continue;
    }

    // AI matching for borderline cases (score 30-79)
    // Cache by listing ID + skill hash to avoid duplicate AI calls
    if (matchScore < 80) {
      const skillHash = userSkills.slice(0, 5).sort().join(',');
      const cacheKey = `${listing.id}:${skillHash}`;
      let aiResult = aiMatchCache.get(cacheKey);

      if (!aiResult) {
        try {
          aiResult = await aiMatchCheck(listing, userSkills, (loop.user as any).resumeText || '', (loop.user as any).name || 'Applicant');
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
        if (matchScore < 50) continue;
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
      const userProfile = {
        name: loop.user.name || 'Applicant',
        skills: (parsedProfile?.skills as string[]) || [],
        experience: (parsedProfile?.experience as string) || loop.user.resumeText?.slice(0, 300) || '',
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
}): string {
  const { coverLetter, userName, recruiterName, applicationId } = params;
  const greeting = recruiterName ? `Hi ${recruiterName}` : 'Hi there';

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
