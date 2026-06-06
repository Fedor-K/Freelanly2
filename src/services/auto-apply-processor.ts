import { prisma } from '@/lib/db';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { generateCoverLetter, generateSubjectLine, generateFollowUp } from '@/services/cover-letter-generator';
import { generateRecruiterRationale } from '@/services/matching/recruiter-rationale';
import { fetchResumeAttachment } from '@/lib/resume-attachment';
import { AutoApplyStatus, Prisma } from '@prisma/client';
import { consumeApplyQuota, refundApplyQuota } from '@/lib/apply-quota';
import { escapeHtml } from '@/lib/html-escape';
import { isScamRecipient } from '@/lib/scam-filter';
import { getRecruiterPortalUrl } from '@/lib/recruiter-token';
import { routeAllows } from '@/lib/loop-routing';
import { isBlockedApplyEmail } from '@/config/blocked-apply-domains';
import { parseJD, buildBreakdown, type ParsedJD } from '@/lib/match-breakdown/generate';
import { computeCaveats, breakdownToVerdict } from '@/lib/match-caveats';
import { runGate, assess } from '@/services/matching/gate';

// Hard gate (assess) enforcement. ON by default; set MATCH_GATE_ENFORCE=0 to fall back to
// shadow-only (compute + render caveats, but don't block) — the kill switch for cutover.
const ENFORCE_GATE = process.env.MATCH_GATE_ENFORCE !== '0';

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
          resumeText: true,
          parsedProfile: true,
          resumeUrl: true,
          resumeGenerated: true,
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

  // Honor recruiter one-click unsubscribes (List-Unsubscribe). Preload once for the batch's
  // recipients; fail OPEN if the table isn't migrated yet so a pending migration never blocks sends.
  const suppressedEmails = new Set<string>();
  try {
    const recipientEmails = [...new Set(pendingApps.map((a) => a.appliedToEmail.toLowerCase().trim()))];
    const sup = await prisma.recruiterSuppression.findMany({ where: { email: { in: recipientEmails } }, select: { email: true } });
    for (const s of sup) suppressedEmails.add(s.email);
  } catch (e) {
    console.warn('[AutoApply] suppression preload skipped (migration pending?):', (e as Error)?.message);
  }

  // Per-recruiter candidate totals — powers a concrete "N candidates for your roles" CTA in the
  // email (a real reason to open the portal; only ~4% do today). Best-effort; keyed on the exact
  // stored appliedToEmail. Counts all sent applications, so it's stable across this batch.
  const candidateCountByEmail = new Map<string, number>();
  try {
    const recipientEmailsExact = [...new Set(pendingApps.map((a) => a.appliedToEmail))];
    const grouped = await prisma.autoApplication.groupBy({
      by: ['appliedToEmail'],
      where: { appliedToEmail: { in: recipientEmailsExact }, sentAt: { not: null } },
      _count: { _all: true },
    });
    // +1 so the freshly-sent application in this batch is included in the recruiter's total.
    for (const g of grouped) candidateCountByEmail.set(g.appliedToEmail, g._count._all + 1);
  } catch (e) {
    console.warn('[AutoApply] candidate-count preload skipped:', (e as Error)?.message);
  }

  // Per-batch cache: parse each JD once (LLM), reuse across candidates sharing the opportunity.
  const jdCache = new Map<string, ParsedJD>();

  for (const app of pendingApps) {
    processed++;

    if (!app.loop.isActive) {
      await markFailed(app.id, 'Auto-apply loop is paused');
      skipped++;
      continue;
    }

    // Language gate for interpreter/translator jobs. Primary enforcement is now in the matcher
    // (before we spend an AI call generating a cover letter), but keep this safety net for
    // pre-existing PENDING apps queued before that gate shipped.
    const langMiss = missingRequiredLanguage(app.jobTitle, app.user.parsedProfile);
    if (langMiss) {
      await markFailed(app.id, `User doesn't speak ${langMiss}`);
      skipped++;
      continue;
    }

    // Global blocklist: never send to a blocked apply domain (safety net — import
    // already drops these, this covers anything already queued).
    if (isBlockedApplyEmail(app.appliedToEmail)) {
      await markFailed(app.id, 'Blocked apply domain');
      skipped++;
      continue;
    }

    // Recruiter opted out via one-click List-Unsubscribe — stop all outreach to them.
    if (suppressedEmails.has(app.appliedToEmail.toLowerCase().trim())) {
      await markFailed(app.id, 'Recruiter unsubscribed');
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
            candidateTitle: typeof parsedProfile?.current_title === 'string' ? parsedProfile.current_title as string : null,
            candidateYears: typeof parsedProfile?.experience_years === 'number' ? parsedProfile.experience_years as number : null,
            candidateLocation: typeof parsedProfile?.location === 'string' ? parsedProfile.location as string : null,
            candidateSalary: app.user.salaryExpectation || null,
            candidateSalaryAt: app.user.salaryExpectationAt ? app.user.salaryExpectationAt.toISOString() : null,
          });
          // CORE deterministic-only (no LLM learnability appeal) — see assess-pairing.ts.
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
          verdict: breakdownToVerdict(matchBreakdown), // honest-mode + missing-strip now driven by the real breakdown
        });
      }

      // Recruiter-voice rationale for the admin audit card — frozen into the stored breakdown.
      if (matchBreakdown && !matchBreakdown.error) {
        const rv = breakdownToVerdict(matchBreakdown);
        const rr = await generateRecruiterRationale({
          jobTitle: app.jobTitle, jobDescription,
          candidateTitle: (parsedProfile?.current_title as string) || null,
          candidateYears: typeof parsedProfile?.experience_years === 'number' ? (parsedProfile.experience_years as number) : null,
          candidateSkills: userSkillsList, candidateBackground: app.user.resumeText || '',
          matched: rv?.matchedSkills || [], missingCore: rv?.missingCore || [], missing: rv?.missing || [],
          profession: (matchBreakdown.profession as string) || null,
          matchedN: (matchBreakdown.matched as number) ?? 0, totalN: (matchBreakdown.total as number) ?? 0,
        });
        if (rr) matchBreakdown.recruiterReasoning = rr;
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
      // CV-from-profile generation was retired: never attach a machine-built PDF
      // (resumeGenerated=true). Those users send without an attachment until they
      // upload a real résumé (a real upload flips the flag back to false). Strong no-CV
      // matches still send as a cover letter with no attachment (owner decision 2026-06-06).
      const resumeAttachment = app.user.resumeGenerated
        ? null
        : await fetchResumeAttachment(app.user.resumeUrl, app.user.resumeFileName);

      // Build email HTML
      const html = buildApplicationEmailHtml({
        coverLetter,
        userName: app.user.name || 'Applicant',
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        recruiterName,
        applicationId: app.id,
        // All sends are brokered via apply@ (Postal), so the recruiter-portal footer always applies.
        recruiterEmail: app.appliedToEmail,
        candidateCount: candidateCountByEmail.get(app.appliedToEmail) || 1,
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

      // All outreach is brokered through Postal (apply@freelanly.com), never the
      // candidate's own mailbox. sendAutoApplyViaPostal sets replyTo to
      // reply+{appId}@reply.freelanly.com (replies return via inbound → portal) and
      // strips the candidate's real address from the body. Hiding the contact by
      // default is what makes "sell contact reveal" possible — if the recruiter
      // already had the reply-to, there'd be nothing to reveal.
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
              sentVia: 'postal',
              coverLetter,
              subject,
              sentAt: now,
              matchBreakdown: matchBreakdown == null ? undefined : (matchBreakdown as Prisma.InputJsonValue), // shadow: frozen, joinable to reply outcome
              // Keep the STORED label in sync with what the card renders (computeCaveats) — stops
              // the "Strong 85 / Good" column-vs-card divergence on real records.
              ...(matchBreakdown ? { matchLabel: computeCaveats(matchBreakdown)?.strength ?? undefined } : {}),
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

// Detects an interpreter/translator listing that names a non-English language the candidate
// doesn't have. Returns the missing language(s) string, or null if the candidate qualifies (or
// the listing isn't language-gated). Single source of truth for both the matcher (skip before
// the AI cover-letter call) and the send-loop safety net.
const LANG_TITLE_RE = /interpret|translat|linguist/i;
const LANG_PATTERN = /\b(uzbek|arabic|chinese|mandarin|cantonese|japanese|korean|thai|vietnamese|hindi|urdu|bengali|tamil|turkish|persian|farsi|russian|portuguese|french|spanish|german|italian|dutch|polish|czech|swedish|norwegian|danish|finnish|greek|hebrew|indonesian|malay|tagalog|swahili|amharic|haitian|creole|tongan|somali)\b/gi;

export function missingRequiredLanguage(jobTitle: string, parsedProfile: unknown): string | null {
  const title = (jobTitle || '').toLowerCase();
  if (!LANG_TITLE_RE.test(title)) return null;
  const jobLangs = [...title.matchAll(LANG_PATTERN)].map((m) => m[0]).filter((l) => l !== 'english');
  if (jobLangs.length === 0) return null;
  const profile = parsedProfile as Record<string, unknown> | null;
  const userLangs = ((profile?.languages as string[]) || []).map((l) => l.toLowerCase());
  const knows = jobLangs.some((jl) => userLangs.some((ul) => ul.includes(jl) || jl.includes(ul)));
  return knows ? null : jobLangs.join(', ');
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
  const provider = (process.env.AI_PROVIDER || 'zai').toLowerCase();
  const client = provider === 'zai'
    ? new OpenAI({ apiKey: process.env.ZAI_API_KEY || '', baseURL: 'https://api.z.ai/api/paas/v4', timeout: 10000 })
    : new OpenAI({ apiKey: process.env.ZAI_API_KEY || '', baseURL: 'https://api.z.ai/api/paas/v4', timeout: 10000 });
  const model = provider === 'zai' ? 'glm-4-32b-0414-128k' : 'glm-4-32b-0414-128k';

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

/**
 * Cheap targeting pre-filter: decide whether a loop is even plausibly relevant to a listing
 * BEFORE spending an LLM call on it. Uses the loop's OWN declared intent (jobTitles +
 * keywords) plus the user's top skills as relevance terms, and passes if any term surfaces
 * in the listing text or skills. Loose by design (high recall): a loop with no usable terms
 * falls through to the LLM, and the LLM's profession gate still makes the final call. This is
 * what makes a listing with thousands of active loops affordable — cross-profession loops
 * (whose terms never appear) are dropped without an LLM call.
 */
function loopMatchesTargeting(
  loop: { jobTitles: string[]; keywords: string | null },
  userSkills: string[],
  haystack: string,
  listingSkillsLower: string[],
): boolean {
  const terms = new Set<string>();
  for (const t of loop.jobTitles || []) {
    for (const tok of t.toLowerCase().split(/[^a-z0-9+#]+/)) {
      if (tok.length >= 2) terms.add(tok);
    }
  }
  if (loop.keywords) {
    for (const k of loop.keywords.toLowerCase().split(',')) {
      const kk = k.trim();
      if (kk.length >= 2) terms.add(kk);
    }
  }
  for (const s of userSkills.slice(0, 8)) {
    const ss = s.toLowerCase().trim();
    if (ss.length >= 3) terms.add(ss);
  }
  if (terms.size === 0) return true; // nothing to filter on → let the LLM decide
  for (const term of terms) {
    if (haystack.includes(term)) return true;
    if (listingSkillsLower.some((ls) => ls.includes(term) || term.includes(ls))) return true;
  }
  return false;
}

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
          resumeGenerated: true,
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

  const titleLower = listing.title.toLowerCase();
  const descLower = listing.description.toLowerCase();
  const haystack = `${titleLower} ${descLower}`;
  const listingSkillsLower = (listing.skills || []).map((s) => s.toLowerCase());

  // Batch the per-listing dedup lookups into two queries instead of two per loop (was
  // ~2 DB round-trips × every active loop = thousands per opportunity).
  const existingUserIds = new Set<string>();
  for (const r of await prisma.autoApplication.findMany({
    where: listing.type === 'job' ? { jobId: listing.id } : { opportunityId: listing.id },
    select: { userId: true },
  })) existingUserIds.add(r.userId);

  const sentToRecruiterUserIds = new Set<string>();
  for (const r of await prisma.autoApplication.findMany({
    where: {
      appliedToEmail: listing.applyEmail,
      jobTitle: { equals: listing.title, mode: 'insensitive' },
      userId: { in: activeLoops.map((l) => l.userId) },
    },
    select: { userId: true },
  })) sentToRecruiterUserIds.add(r.userId);

  // CHEAP-GATE PASS: reject everything we can without the LLM (dedup, blacklist, exclude
  // keywords, full pending queue, empty profile) plus a targeting pre-filter. With thousands
  // of active loops this is what makes one opportunity affordable — only plausible candidates
  // reach the (expensive) AI step. Preserves the fairness order set above.
  type Cand = {
    loop: (typeof activeLoops)[number];
    userSkills: string[];
    userLangs: string[] | undefined;
    userLoc: string | undefined;
    userTitle: string;
    userField: string;
  };
  const candidates: Cand[] = [];
  for (const loop of activeLoops) {
    // Direction routing (cheapest cut, before dedup/targeting/AI): only consider a loop whose
    // professional directions match the listing's category (or an adjacent one). Fail-open when the
    // loop is unclassified (categorySlugs empty) so we never silently drop an un-categorised user.
    if (!routeAllows(loop.categorySlugs, listing.categorySlug)) continue;
    if (existingUserIds.has(loop.userId)) continue; // already applied to this listing
    if (sentToRecruiterUserIds.has(loop.userId)) continue; // same recruiter+title already
    if (loop.blacklistCompanies.some((bc) => bc.toLowerCase() === listing.companyName.toLowerCase())) continue;
    if (loop.excludeKeywords) {
      const excludes = loop.excludeKeywords.toLowerCase().split(',').map((k) => k.trim()).filter(Boolean);
      if (excludes.some((ex) => haystack.includes(ex))) continue;
    }
    // Don't queue past the user's drainable backlog — extra PENDING just expires unsent.
    if ((pendingByUser.get(loop.userId) || 0) >= MAX_PENDING_PER_USER) continue;

    const userProfile = loop.user.parsedProfile as Record<string, unknown> | null;
    const userSkills = (userProfile?.skills as string[]) || [];
    const userLangsList = (userProfile?.languages as string[]) || [];
    // Skip invalid/sparse profiles (no skills + no languages = not a real resume).
    if (userSkills.length === 0 && userLangsList.length === 0) continue;

    // Targeting pre-filter — skip the LLM for loops with no surface overlap with the listing.
    if (!loopMatchesTargeting(loop, userSkills, haystack, listingSkillsLower)) continue;

    candidates.push({
      loop,
      userSkills,
      userLangs: userLangsList.length ? userLangsList : undefined,
      userLoc: (userProfile?.location as string) || undefined,
      userTitle: (userProfile?.current_title as string) || '',
      userField: (userProfile?.field as string) || '',
    });
  }

  // PARALLEL AI PASS: evaluate candidates in concurrent chunks (was one sequential await per
  // loop — the dominant cost: ~18 min/opportunity at thousands of loops). Stop launching
  // chunks once we have enough matches to fill the listing's budget. Decisions are identical
  // to the sequential version (same cache, same shouldApply gate), just concurrent.
  const AI_CONCURRENCY = 20;
  const matched: { cand: Cand; matchScore: number; matchLabel: string }[] = [];
  const aiRejects: { cand: Cand; reason: string; score: number }[] = []; // AI-match said NO — logged for the audit (mirror of the test batches: every considered pairing shows a decision)
  for (let i = 0; i < candidates.length && matched.length < budget; i += AI_CONCURRENCY) {
    const chunk = candidates.slice(i, i + AI_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (c): Promise<{ shouldApply: boolean; score: number; reason: string } | null> => {
        const skillHash = c.userSkills.slice(0, 5).sort().join(',') + ':' + (c.userLoc || '') + ':' + c.userTitle;
        const cacheKey = `${listing.id}:${skillHash}`;
        const cached = aiMatchCache.get(cacheKey);
        if (cached) return cached;
        try {
          const r = await aiMatchCheck(listing, c.userSkills, (c.loop.user as any).resumeText || '', (c.loop.user as any).name || 'Applicant', c.userLangs, c.userLoc, c.userTitle, c.userField);
          aiMatchCache.set(cacheKey, r);
          return r;
        } catch {
          return null; // AI failed — skip rather than send bad match
        }
      })
    );
    for (let j = 0; j < chunk.length; j++) {
      const r = results[j];
      if (r && r.shouldApply) {
        matched.push({ cand: chunk[j], matchScore: r.score, matchLabel: r.score >= 80 ? 'Strong' : r.score >= 50 ? 'Good' : 'Weak' });
      } else if (r) {
        aiRejects.push({ cand: chunk[j], reason: r.reason || 'не подходит по AI-оценке', score: r.score });
      }
    }
  }

  // CREATE PASS: queue applications for matched candidates up to budget (fairness order).
  let queued = 0;
  let gated = 0; // blocked by the hard gate (assess === NO)
  let qParsedJD: ParsedJD | undefined; // parse the JD once per listing, reuse per candidate
  for (const m of matched) {
    if (queued >= budget) break;
    const loop = m.cand.loop;
    if ((pendingByUser.get(loop.userId) || 0) >= MAX_PENDING_PER_USER) continue;

    // Language gate BEFORE the AI cover-letter call: an interpreter/translator listing in a
    // language the candidate doesn't have would only be marked FAILED at send time anyway, after
    // we'd already paid for a generated letter. Skip it here so we never spend that AI call.
    if (missingRequiredLanguage(listing.title, loop.user.parsedProfile)) continue;

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
    let qBreakdown: Record<string, unknown> | null = null; // breakdown drives the verdict-aware letter + the honest label
    try {
      const parsedProfile = loop.user.parsedProfile as Record<string, unknown> | null;
      // Verdict from the SAME breakdown the recruiter will see — so honest-mode/missing-strip
      // actually run on the queued letter (not just shadow). FAIL-OPEN: any failure → no verdict,
      // letter still generates (as before).
      let qVerdict: ReturnType<typeof breakdownToVerdict>;
      let gateBlocked = false;
      try {
        const jdText = `${listing.title}\n${listing.description}`;
        if (!qParsedJD) qParsedJD = await parseJD(jdText);
        const bd = buildBreakdown(qParsedJD, {
          jdText, cvText: loop.user.resumeText || '',
          candidateSkills: (parsedProfile?.skills as string[]) || [],
          candidateLanguages: (parsedProfile?.languages as string[]) || [],
          candidateTitle: typeof parsedProfile?.current_title === 'string' ? parsedProfile.current_title as string : null,
          candidateYears: typeof parsedProfile?.experience_years === 'number' ? parsedProfile.experience_years as number : null,
          candidateLocation: typeof parsedProfile?.location === 'string' ? parsedProfile.location as string : null,
        });
        // CORE deterministic-only (no LLM learnability appeal) — see assess-pairing.ts.
        const ratio = bd.total ? bd.matched / bd.total : 0;
        const qLines = (bd.lines as Array<{ core?: boolean; status?: string }>) || [];
        const qMissingCore = qLines.filter((l) => l.core === true && l.status !== 'full').length;
        const qCoreMatched = qLines.filter((l) => l.core === true && l.status === 'full').length;
        qBreakdown = {
          v: 1, matched: bd.matched, total: bd.total, ratio: Math.round(ratio * 100) / 100, lines: bd.lines,
          yearsContext: bd.yearsContext, locationContext: bd.locationContext, rejected: bd.rejected, fallback: bd.fallback, shadow: true,
        };
        // HARD GATE — profession / language / location / seniority / work-auth / native-language +
        // evidence bar. A NO blocks the send; its signals are merged into the breakdown so caveats
        // render on a SEND too. FAIL-OPEN: any gate error -> no block, send exactly as before.
        try {
          const g = await runGate({
            jobTitle: listing.title, jobDescription: listing.description, jobCountry: listing.country,
            candidateTitle: typeof parsedProfile?.current_title === 'string' ? parsedProfile.current_title as string : undefined,
            candidateField: typeof parsedProfile?.field === 'string' ? parsedProfile.field as string : undefined,
            candidateYears: typeof parsedProfile?.experience_years === 'number' ? parsedProfile.experience_years as number : null,
            candidateLocation: typeof parsedProfile?.location === 'string' ? parsedProfile.location as string : undefined,
            candidateLanguages: (parsedProfile?.languages as string[]) || [],
            candidateSkills: (parsedProfile?.skills as string[]) || [],
            candidateCv: loop.user.resumeText || '',
          });
          const hasRealCV = !!loop.resumeUrl && !loop.user.resumeGenerated;
          const decision = assess(g, { matched: bd.matched, total: bd.total, missingCore: qMissingCore, coreMatched: qCoreMatched }, loop.user.resumeText || '', listing.title, hasRealCV);
          Object.assign(qBreakdown, {
            profession: decision.extras.profession, english_req: decision.extras.english_req, english_level: decision.extras.english_level,
            hard_fail: decision.extras.hard_fail, hard_kind: decision.extras.hard_kind, hard_detail: decision.extras.hard_detail,
            location_flag: decision.extras.location_flag, location_detail: decision.extras.location_detail, gateReason: decision.reason,
          });
          if (ENFORCE_GATE && decision.decision === 'NO') gateBlocked = true;
        } catch { /* gate failed -> fail-open, no block */ }
        qVerdict = breakdownToVerdict(qBreakdown);
      } catch { /* fail-open: no verdict, letter still generated */ }
      if (gateBlocked) {
        gated++;
        // Persist the REJECTED decision so the admin audit shows EVERY processed pairing, not just
        // the sends. Mirror of the create below: status REJECTED, no cover, gateReason in the
        // breakdown. Unique (userId, opportunityId) → re-evaluations of the same pair are deduped.
        try {
          await prisma.autoApplication.create({
            data: {
              userId: loop.userId, loopId: loop.id,
              jobId: listing.type === 'job' ? listing.id : null,
              opportunityId: listing.type === 'opportunity' ? listing.id : null,
              companyName: realCompanyName, jobTitle: listing.title, appliedToEmail: listing.applyEmail,
              matchScore: m.matchScore,
              matchLabel: (qBreakdown ? computeCaveats(qBreakdown)?.strength : undefined) ?? m.matchLabel,
              matchBreakdown: qBreakdown ? (qBreakdown as Prisma.InputJsonValue) : undefined,
              coverLetter: '', subject: '', resumeUrl: loop.resumeUrl,
              status: AutoApplyStatus.REJECTED,
            },
          });
        } catch (error) {
          if (!String(error).includes('Unique constraint')) console.error(`[AutoApply] Error logging rejected pairing for loop ${loop.id}:`, error);
        }
        continue; // hard gate said NO — do not queue/send this pairing
      }
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
          verdict: qVerdict,
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
          matchScore: m.matchScore,
          // Label from the breakdown's caveats (same source as the card) when available, else the
          // score tier. Also store the breakdown now, so queued records aren't "—" no-breakdown.
          matchLabel: (qBreakdown ? computeCaveats(qBreakdown)?.strength : undefined) ?? m.matchLabel,
          matchBreakdown: qBreakdown ? (qBreakdown as Prisma.InputJsonValue) : undefined,
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

  // Log AI-match rejections (every considered candidate that the AI judged not a fit) so the admin
  // audit shows the SAME full picture as the test batches — not just sends + the rare hard-gate cut.
  // Deterministic breakdown (reuses the once-per-listing parsed JD → no extra LLM). Best-effort: any
  // failure here must never touch the live send flow above.
  if (aiRejects.length) {
    try {
      const jdText = `${listing.title}\n${listing.description}`;
      qParsedJD = qParsedJD ?? (await parseJD(jdText));
      const rows = aiRejects.map((ar) => {
        let bd: Record<string, unknown> | undefined;
        try {
          const b = buildBreakdown(qParsedJD!, {
            jdText, cvText: ar.cand.loop.user.resumeText || '', candidateSkills: ar.cand.userSkills,
            candidateLanguages: ar.cand.userLangs || [], candidateTitle: ar.cand.userTitle || null,
            candidateYears: typeof (ar.cand.loop.user.parsedProfile as any)?.experience_years === 'number' ? (ar.cand.loop.user.parsedProfile as any).experience_years : null,
            candidateLocation: ar.cand.userLoc || null,
          });
          bd = { v: 1, matched: b.matched, total: b.total, ratio: b.total ? Math.round((b.matched / b.total) * 100) / 100 : 0, lines: b.lines, yearsContext: b.yearsContext, locationContext: b.locationContext, rejected: b.rejected, fallback: b.fallback, decision: 'NO', gateReason: 'не прошёл AI-match' };
        } catch { /* breakdown failed — log the reject without skill lines */ }
        return {
          userId: ar.cand.loop.userId, loopId: ar.cand.loop.id,
          jobId: listing.type === 'job' ? listing.id : null,
          opportunityId: listing.type === 'opportunity' ? listing.id : null,
          companyName: listing.companyName, jobTitle: listing.title, appliedToEmail: listing.applyEmail,
          matchScore: ar.score, matchLabel: bd ? (computeCaveats(bd)?.strength ?? null) : null,
          matchBreakdown: bd ? (bd as Prisma.InputJsonValue) : undefined,
          coverLetter: '', subject: '', resumeUrl: ar.cand.loop.resumeUrl,
          status: AutoApplyStatus.REJECTED,
        };
      });
      await prisma.autoApplication.createMany({ data: rows, skipDuplicates: true });
    } catch (e) {
      console.error('[AutoApply] ai-reject audit log failed (non-fatal):', e);
    }
  }

  if (queued > 0 || gated > 0 || aiRejects.length > 0) {
    console.log(
      `[AutoApply] Queued ${queued}${gated > 0 ? `, gated ${gated}` : ''}${aiRejects.length ? `, ai-rejected ${aiRejects.length}` : ''} (assess=NO${ENFORCE_GATE ? '' : ', shadow'}) for ${listing.type} "${listing.title}"`
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
  /** Total candidates this recruiter has (incl. this one) — drives a concrete portal CTA. */
  candidateCount?: number;
}): string {
  const { coverLetter, userName, jobTitle, applicationId, recruiterEmail, candidateCount } = params;
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
  // Concrete CTA when the recruiter has more than one candidate — a real reason to open the portal.
  const hasMany = typeof candidateCount === 'number' && candidateCount > 1;
  const bannerSub = hasMany
    ? `You now have ${candidateCount} candidates for your roles. Reply, view CVs, and manage them all in one place.`
    : `Reply, view their CV, and manage everyone who applied to your roles — all in one place.`;
  const bannerCta = hasMany ? `View all ${candidateCount} candidates &rarr;` : `Open your candidates &amp; reply &rarr;`;
  const portalBanner = recruiterEmail
    ? `<table role="presentation" width="100%" style="margin: 0 0 22px; border-collapse: collapse;">
    <tr><td style="background: #F4F8E8; border: 1px solid #C7F94A; border-radius: 12px; padding: 16px 20px;">
      <div style="font-size: 14px; font-weight: 700; color: #0B0C0F; margin-bottom: 3px;">New applicant for ${escapeHtml(jobTitle)}</div>
      <div style="font-size: 13px; color: #555; line-height: 1.5; margin-bottom: 13px;">${bannerSub}</div>
      <a href="${portalUrl}" style="display: inline-block; padding: 10px 24px; background: #0B0C0F; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px;">${bannerCta}</a>
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
  ${paragraphs}
  ${portalBanner}
  ${portalCta}
  ${trackingPixel}
</body>
</html>
  `.trim();
}

// Bootstrap the matcher's processed-marker column once per process. It is kept OUT of the
// Prisma schema on purpose: declaring it would make the generated client SELECT "matchedAt"
// in every Opportunity read across the app (public pages, sitemap, other crons), which would
// 500 on any deploy that lands before the column exists in the DB. Managing it via idempotent
// raw DDL here means this change needs no migration and breaks no other code path; the cron
// (which runs on prod, where DB access exists) applies it on its first run and self-heals.
let matcherSchemaReady = false;
async function ensureMatcherSchema(): Promise<void> {
  if (matcherSchemaReady) return;
  // Additive + nullable => instant, no table rewrite. IF NOT EXISTS => idempotent and safe
  // under concurrent cold-start instances.
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "matchedAt" TIMESTAMP(3)`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Opportunity_matchedAt_createdAt_idx" ON "Opportunity" ("matchedAt", "createdAt" DESC)`
  );
  // One-time backfill so the first runs don't re-evaluate the entire history: mark rows that
  // already produced applications, or that are older than the matching window. Rows within
  // 3 days with no applications stay NULL — that's the genuine backlog, which then drains.
  await prisma.$executeRawUnsafe(
    `UPDATE "Opportunity" SET "matchedAt" = "createdAt"
     WHERE "matchedAt" IS NULL
       AND (
         id IN (SELECT DISTINCT "opportunityId" FROM "AutoApplication" WHERE "opportunityId" IS NOT NULL)
         OR "createdAt" < NOW() - INTERVAL '3 days'
       )`
  );
  matcherSchemaReady = true;
}

/**
 * Pull-model: find recent opportunities/jobs with applyEmail
 * and match them against active auto-apply loops.
 * Creates PENDING AutoApplications for matches.
 * Called by cron every 15 min.
 */
export async function matchAndQueueAutoApplies(): Promise<number> {
  let totalQueued = 0;

  // Self-bootstrap the matchedAt marker. If it fails (transient DB error), bail and retry
  // next run rather than query a column that may not exist yet.
  try {
    await ensureMatcherSchema();
  } catch (e) {
    console.error('[AutoApply] matcher schema bootstrap failed, retrying next run:', e);
    return 0;
  }

  // Recent UNPROCESSED opportunities (matchedAt IS NULL), freshest first. matchedAt is what
  // turns this into a draining queue instead of a sliding window: previously this took the
  // newest 100 by createdAt every run with no processed-marker, so it re-scanned the same
  // top rows (~245 dedup queries per opportunity wasted re-confirming "already done") and
  // never reached opportunities that scrolled past the limit — at higher inflow those older
  // ones were abandoned unprocessed (the growing backlog). Raw query because matchedAt is
  // intentionally not in the Prisma model (see ensureMatcherSchema).
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Opportunity"
    WHERE "isActive" = true
      AND "applyEmail" IS NOT NULL
      AND "matchedAt" IS NULL
      AND "createdAt" >= NOW() - INTERVAL '3 days'
    ORDER BY "createdAt" DESC
    LIMIT 150
  `;

  for (const opp of rows) {
    try {
      const queued = await queueAutoApplyForOpportunity(opp.id);
      totalQueued += queued;
      // Mark processed only on a clean return (including 0 matches — a niche gig nobody
      // matches is still "done"). On a thrown error leave matchedAt NULL so transient
      // failures retry next run instead of being silently abandoned.
      await prisma.$executeRaw`UPDATE "Opportunity" SET "matchedAt" = NOW() WHERE id = ${opp.id}`;
    } catch (e) {
      console.error(`[AutoApply] Error queuing opportunity ${opp.id}:`, e);
    }
  }

  console.log(`[AutoApply] Matched ${rows.length} opportunities, queued ${totalQueued} applications`);
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
          email: true,
          plan: true,
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

  // Honor recruiter unsubscribes for follow-ups too (fail open if the table isn't migrated).
  const fuSuppressed = new Set<string>();
  try {
    const emails = [...new Set(candidates.map((a) => a.appliedToEmail.toLowerCase().trim()))];
    const sup = await prisma.recruiterSuppression.findMany({ where: { email: { in: emails } }, select: { email: true } });
    for (const s of sup) fuSuppressed.add(s.email);
  } catch { /* fail open */ }

  for (const app of candidates) {
    // Follow-ups stay PRO-only, but no longer require a personal SMTP — they now
    // go through Postal like the initial send (brokered, replies → portal).
    if (app.user.plan !== 'PRO' || !app.loop.isActive) {
      continue;
    }
    // Recruiter opted out via List-Unsubscribe — no follow-ups either.
    if (fuSuppressed.has(app.appliedToEmail.toLowerCase().trim())) {
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

      const result = await sendAutoApplyViaPostal({
        userName: app.user.name || 'Applicant',
        userEmail: app.user.email,
        to: app.appliedToEmail,
        subject,
        html,
        text,
        applicationId: app.id,
      });

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
