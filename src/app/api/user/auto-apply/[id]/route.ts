import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine } from '@/services/cover-letter-generator';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';
import { sendViaGmail } from '@/lib/gmail-sender';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { buildApplicationEmailHtml } from '@/services/auto-apply-processor';
import { consumeApplyQuota, refundApplyQuota, hasApplyAllowance, consumeApplyCredit, refundApplyCredit, refundFreeSend, applyLimitResponse } from '@/lib/apply-quota';
import { fetchResumeAttachment } from '@/lib/resume-attachment';
import { generateTailoredCv } from '@/lib/tailored-cv';

function cleanReplyText(text: string | null): string | null {
  if (!text) return null;
  let clean = text
    .replace(/--[0-9a-fA-F]{20,}\s*/g, '')
    .replace(/--[a-zA-Z0-9_=.-]{10,}--?\s*/g, '')
    .replace(/--_\d+_[a-zA-Z0-9]+_\s*/g, '')
    .replace(/------=[_a-zA-Z0-9.]+\s*/g, '')
    .replace(/boundary="[^"]*"\s*/g, '')
    .replace(/Content-Type:[^\n]*\n/gi, '')
    .replace(/Content-Transfer-Encoding:[^\n]*\n/gi, '')
    .replace(/Content-Disposition:[^\n]*\n/gi, '')
    .replace(/This is a multi-part message in MIME format\.\s*/gi, '')
    .replace(/\[cid:[^\]]*\]/g, '')
    .replace(/\r?\n{3,}/g, '\n\n')
    .trim();
  // Trim quoted original message ("On ... wrote:" or "From: ... Sent:")
  const quoteIdx = clean.search(/\n\s*On .{10,120} wrote:?\s*$/m);
  if (quoteIdx > 20) clean = clean.slice(0, quoteIdx).trim();
  // Also catch "On ... wrote:\n>" style
  const quoteIdx2 = clean.search(/\n\s*On .{10,120} wrote:?\s*\n/m);
  if (quoteIdx2 > 20) clean = clean.slice(0, quoteIdx2).trim();
  const fromIdx = clean.search(/\n\s*From: .{5,80}\n\s*Sent:/m);
  if (fromIdx > 20) clean = clean.slice(0, fromIdx).trim();
  const fromIdx2 = clean.search(/\nFrom: .{3,60}\s*\n/m);
  if (fromIdx2 > 20) clean = clean.slice(0, fromIdx2).trim();
  const sentFromIdx = clean.search(/\n\s*Sent from (my iPhone|my iPad|Mail for Windows|Samsung|Proton Mail|Yahoo Mail)/im);
  if (sentFromIdx > 20) clean = clean.slice(0, sentFromIdx).trim();
  // Strip email quote lines starting with >
  clean = clean.replace(/\n\s*>.*$/gm, '').replace(/\n{2,}$/g, '').trim();
  // Strip trailing underscores/dashes (signature separators)
  clean = clean.replace(/\n\s*[_-]{3,}\s*$/m, '').trim();
  return clean;
}

/**
 * GET /api/user/auto-apply/[id] — Full application detail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const app = await prisma.autoApplication.findFirst({
      where: { id, userId: session.user.id },
      include: {
        loop: { select: { name: true, followUpDay1: true, followUpDay2: true, followUpEnabled: true } },
        user: { select: { parsedProfile: true } },
      },
    });

    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Get job/opportunity description
    let description = '';
    let originalUrl: string | null = null;
    if (app.jobId) {
      const job = await prisma.job.findUnique({
        where: { id: app.jobId },
        select: { description: true, sourceUrl: true },
      });
      description = job?.description || '';
      originalUrl = job?.sourceUrl || null;
    } else if (app.opportunityId) {
      const opp = await prisma.opportunity.findUnique({
        where: { id: app.opportunityId },
        select: { description: true, sourceUrl: true },
      });
      description = opp?.description || '';
      originalUrl = opp?.sourceUrl || null;
    }

    // Find similar jobs (same category/skills)
    const similar = app.jobId
      ? await prisma.job.findMany({
          where: { id: { not: app.jobId }, title: { contains: app.jobTitle.split(' ')[0], mode: 'insensitive' } },
          select: { id: true, title: true, company: { select: { name: true } }, salaryMin: true, salaryMax: true, salaryCurrency: true },
          take: 3,
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // Auto follow-ups killed 2026-07-11 (owner decision) — no scheduled touches, only what actually happened.
    const followUpSchedule = [
      { touch: 1, day: 0, label: 'Initial outreach', status: app.sentAt ? 'sent' : 'pending', date: app.sentAt },
      ...(app.followUpSentAt ? [{ touch: 2, day: 0, label: 'Follow-up (historical)', status: 'sent', date: app.followUpSentAt }] : []),
    ];

    // "Why matched" — explain match reasons
    const userProfile = app.user?.parsedProfile as Record<string, unknown> | null;
    const userSkills = ((userProfile?.skills as string[]) || []).map(s => s.toLowerCase());
    const userLangs = ((userProfile?.languages as string[]) || []).map(l => l.toLowerCase());
    const titleLower = app.jobTitle.toLowerCase();
    const descLower = description.toLowerCase();

    const matchReasons: string[] = [];
    const matchedSkills = userSkills.filter(s => titleLower.includes(s) || descLower.includes(s));
    if (matchedSkills.length > 0) {
      matchReasons.push(`Skills match: ${matchedSkills.slice(0, 5).join(', ')}`);
    }
    if (userLangs.some(l => titleLower.includes(l) || descLower.includes(l))) {
      matchReasons.push('Language requirement matches your profile');
    }
    if (app.matchScore && app.matchScore >= 80) {
      matchReasons.push('Strong overall fit based on your experience and skills');
    } else if (app.matchScore && app.matchScore >= 50) {
      matchReasons.push('Good fit — several key requirements match your profile');
    }

    return NextResponse.json({
      ...app,
      replyText: cleanReplyText(app.replyText),
      description,
      originalUrl,
      similar: similar.map(s => ({ id: s.id, title: s.title, company: s.company?.name, salary: s.salaryMin ? `${s.salaryCurrency || 'USD'} ${s.salaryMin.toLocaleString()}${s.salaryMax ? '–' + s.salaryMax.toLocaleString() : ''}` : null })),
      followUpSchedule,
      whyMatched: matchReasons,
    });
  } catch (error) {
    console.error('[AutoApply Detail] GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * POST /api/user/auto-apply/[id] — Actions: regenerate, swap-template, adjust-tone
 * Body: { action: 'regenerate' | 'swap-template' | 'adjust-tone', templateId?, tone? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Money-gate refund state, hoisted to FUNCTION scope so the outer catch (an exception after the
  // consume) can give back a paid credit / free slot / daily slot instead of leaking it.
  let refundUserId: string | null = null;
  let refundPlan = 'FREE';
  let creditConsumed = false;
  let freeReserved = false;
  let refunded = false;
  let sent = false; // the email already went out — a later throw (e.g. the SENT status update) must NOT refund it
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { action, templateId, tone, followUpDay1, followUpDay2, followUpEnabled } = body;

    const app = await prisma.autoApplication.findFirst({
      where: { id, userId: session.user.id },
      include: {
        user: { select: { name: true, parsedProfile: true, resumeText: true } },
      },
    });

    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Get job description
    let jobDescription = '';
    if (app.jobId) {
      const job = await prisma.job.findUnique({ where: { id: app.jobId }, select: { description: true } });
      jobDescription = job?.description || '';
    } else if (app.opportunityId) {
      const opp = await prisma.opportunity.findUnique({ where: { id: app.opportunityId }, select: { description: true } });
      jobDescription = opp?.description || '';
    }

    const parsedProfile = app.user.parsedProfile as Record<string, unknown> | null;

    if (action === 'regenerate') {
      // Generation is free now (owner decision 2026-07-13) — the paywall moved to the SEND (send-now).
      // Load full opportunity/job data for AI context
      let fullDescription = jobDescription;
      let posterName = app.companyName;
      let recruiterEmail = app.appliedToEmail || '';
      let originalContent = '';

      if (app.opportunityId) {
        const opp = await prisma.opportunity.findUnique({
          where: { id: app.opportunityId },
          select: { description: true, originalContent: true, clientName: true, clientHeadline: true, posterCompany: true, applyEmail: true, company: { select: { name: true } } },
        });
        if (opp) {
          fullDescription = opp.description;
          originalContent = opp.originalContent || '';
          posterName = opp.company?.name || opp.posterCompany || opp.clientName || app.companyName;
          recruiterEmail = opp.applyEmail || recruiterEmail;
        }
      }

      const coverLetter = await generateCoverLetter({
        jobTitle: app.jobTitle,
        jobDescription: originalContent ? `${fullDescription}\n\n--- Original LinkedIn post ---\n${originalContent.slice(0, 500)}` : fullDescription,
        companyName: posterName,
        userProfile: {
          name: app.user.name || 'Applicant',
          skills: (parsedProfile?.skills as string[]) || [],
          experience: (app.user.resumeText || '').slice(0, 500),
          languages: (parsedProfile?.languages as string[]) || [],
          recruiterEmail,
        } as any,
      });

      const subject = await generateSubjectLine({ jobTitle: app.jobTitle, userName: app.user.name || 'Applicant' });

      await prisma.autoApplication.update({
        where: { id },
        data: { coverLetter, subject },
      });

      return NextResponse.json({ ok: true, coverLetter, subject });
    }

    if (action === 'swap-template') {
      if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

      const template = await prisma.coverLetterTemplate.findFirst({
        where: { id: templateId, userId: session.user.id },
      });

      if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

      // Generate cover letter using template
      const coverLetter = await generateCoverLetter({
        jobTitle: app.jobTitle,
        jobDescription,
        companyName: app.companyName,
        userProfile: {
          name: app.user.name || 'Applicant',
          skills: (parsedProfile?.skills as string[]) || [],
          experience: (app.user.resumeText || '').slice(0, 300),
          languages: (parsedProfile?.languages as string[]) || [],
        },
        styleOverride: template.body,
      });

      await prisma.autoApplication.update({
        where: { id },
        data: { coverLetter, subject: template.subject || app.subject },
      });

      return NextResponse.json({ ok: true, coverLetter, subject: template.subject || app.subject, templateName: template.name });
    }

    if (action === 'adjust-tone') {
      const toneMap: Record<string, string> = {
        formal: 'Write in a formal, professional tone. Use complete sentences, proper titles.',
        casual: 'Write in a casual, friendly tone. Short sentences, conversational.',
        direct: 'Write in a direct, concise tone. No fluff, straight to the point.',
        enthusiastic: 'Write in an enthusiastic, energetic tone. Show genuine excitement.',
      };

      const styleOverride = toneMap[tone || 'casual'] || toneMap.casual;

      const coverLetter = await generateCoverLetter({
        jobTitle: app.jobTitle,
        jobDescription,
        companyName: app.companyName,
        userProfile: {
          name: app.user.name || 'Applicant',
          skills: (parsedProfile?.skills as string[]) || [],
          experience: (app.user.resumeText || '').slice(0, 300),
          languages: (parsedProfile?.languages as string[]) || [],
        },
        styleOverride: `${styleOverride} Write a 3-5 sentence cover letter body. ONLY mention skills the applicant has. No greeting or signature. Under 150 words.`,
      });

      await prisma.autoApplication.update({
        where: { id },
        data: { coverLetter },
      });
      prisma.user.update({ where: { id: session.user.id }, data: { aiGenerationsUsed: { increment: 1 } } }).catch(() => {});

      return NextResponse.json({ ok: true, coverLetter, tone });
    }

    if (action === 'move-stage') {
      const validStatuses = ['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'];
      if (!body.status || !validStatuses.includes(body.status)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      await prisma.autoApplication.update({ where: { id }, data: { status: body.status } });
      return NextResponse.json({ ok: true });
    }

    if (action === 'send-now') {
      if (!['PENDING', 'REVIEW', 'SENDING'].includes(app.status)) {
        return NextResponse.json({ error: 'Can only send queued applications' }, { status: 400 });
      }

      // Dedup: don't send twice to the same listing (a second queued row for the same opportunity,
      // or a re-click racing the first send). Mirrors quick-apply's already_applied guard — this
      // route previously had NO such check.
      const dupe = await prisma.autoApplication.findFirst({
        where: {
          userId: session.user.id,
          id: { not: id },
          sentAt: { not: null },
          ...(app.opportunityId ? { opportunityId: app.opportunityId } : { appliedToEmail: app.appliedToEmail, jobTitle: app.jobTitle }),
        },
        select: { id: true },
      });
      if (dupe) {
        await prisma.autoApplication.update({ where: { id }, data: { status: 'SKIPPED' } }).catch(() => {});
        return NextResponse.json({ error: 'already_applied', message: 'You already applied to this role.' }, { status: 409 });
      }

      // Fetch full user data for sending
      const fullUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, plan: true, userSmtp: true, gmailAuth: true, resumeUrl: true, resumeFileName: true },
      });
      if (!fullUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      // APPLICATION PAYWALL (owner decision 2026-07-13, credits 2026-07-21): first application free,
      // every send after needs a purchased credit ($3/pack) or PRO. Read-only pre-check here; the atomic
      // credit consume is right before the irreversible send below (after the postal bar + daily cap).
      if (fullUser.plan === 'FREE' && !(await hasApplyAllowance(session.user.id, fullUser.plan))) {
        return NextResponse.json(applyLimitResponse(), { status: 402 });
      }

      // Postal bar (mirrors quick-apply): our-name sending is reserved for the strongest matches.
      // The queue now contains honest Weak rows too (matcher queues evidence-bar misses for review),
      // and those may only go out from the user's OWN inbox — never from our domain.
      {
        const hasOwn = !!fullUser.userSmtp?.verified || !!fullUser.gmailAuth?.verified;
        if (!hasOwn) {
          const POSTAL_TIER = (process.env.POSTAL_SEND_TIER || 'strong').toLowerCase(); // 'strong' | 'good'
          const bdDecision = String((app.matchBreakdown as { decision?: string } | null)?.decision || 'SEND'); // legacy rows without a breakdown: fail-open
          const label = String(app.matchLabel || '');
          const meetsPostalBar = bdDecision === 'SEND' && (POSTAL_TIER === 'good' ? /strong|good/i.test(label) : /strong/i.test(label));
          if (!meetsPostalBar) {
            return NextResponse.json({
              error: 'smtp_required',
              reason: 'not_strong',
              message: 'Sending from Freelanly is reserved for your strongest fits. Connect your own email (Settings → Integrations) to send this one yourself — from your address, no limits.',
            }, { status: 422 });
          }
        }
      }

      // Daily send cap (same 20/UTC-day as quick-apply — this route previously bypassed it entirely).
      // Atomic consume before sending; refunded below if the send fails.
      if (!(await consumeApplyQuota(session.user.id, fullUser.plan))) {
        // Cap still enforced; owner asked to keep limit wording out of the UI (2026-07-30).
        return NextResponse.json({ error: 'limit_reached', message: "That's all your sends for today — new ones open up tomorrow." }, { status: 429 });
      }
      // Arm the refund sentinel the instant the daily slot is taken, BEFORE the cover-letter / CV / credit
      // steps below can throw — otherwise a thrown LLM call leaves the daily slot consumed with no send.
      refundUserId = session.user.id;
      refundPlan = fullUser.plan;

      // Generate cover letter if missing
      let coverLetter = app.coverLetter;
      let subject = app.subject;
      if (!coverLetter) {
        coverLetter = await generateCoverLetter({
          jobTitle: app.jobTitle,
          jobDescription: jobDescription.slice(0, 800),
          companyName: app.companyName,
          userProfile: { name: fullUser.name || 'Applicant', skills: [], experience: '' },
        });
      }
      if (!subject) {
        subject = await generateSubjectLine({ jobTitle: app.jobTitle, userName: fullUser.name || 'Applicant' });
      }

      const hasSmtp = !!fullUser.userSmtp?.verified;
      // verified required: a grant where the user declined gmail.send exists but 403s on send. Route
      // those to Postal instead of hard-failing (same fix as quick-apply).
      const hasGmail = !!fullUser.gmailAuth?.verified;
      const ownInbox = hasSmtp || hasGmail;
      const html = buildApplicationEmailHtml({
        coverLetter,
        userName: fullUser.name || 'Applicant',
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        recruiterName: '',
        applicationId: id,
        recruiterEmail: ownInbox ? undefined : app.appliedToEmail,
      });

      // Attach the CV — this route used to send queue items with NO résumé attached (unlike
      // quick-apply), the recruiters' #1 ask. The user's OWN résumé file always wins (owner decision
      // 2026-07-16): a generated CV is built from the lossy parsedProfile and amplifies its parsing
      // defects. Generation is a fallback for users with no real file only.
      let cv = await fetchResumeAttachment(fullUser.resumeUrl, fullUser.resumeFileName || undefined);
      if (!cv) {
        cv = await generateTailoredCv({
          profile: (app.user?.parsedProfile ?? null) as import('@/lib/recruiter-cv').CvProfile | null,
          userName: fullUser.name || '',
          jobTitle: app.jobTitle,
          jobDescription,
          companyName: app.companyName,
        });
      }

      // MONEY GATE: consume one apply-credit atomically, immediately before the irreversible send and
      // after every other gate (postal bar, daily cap). A wall here is only the rare race; the daily
      // slot was already taken, so give it back. `creditConsumed` drives the refund on send failure.
      const _creditGate = await consumeApplyCredit(session.user.id, fullUser.plan);
      if (!_creditGate.allowed) {
        await refundApplyQuota(session.user.id, fullUser.plan); // hand back the daily slot taken above
        return NextResponse.json(applyLimitResponse(), { status: 402 });
      }
      creditConsumed = _creditGate.creditConsumed;
      freeReserved = _creditGate.freeReserved;
      refundUserId = session.user.id;
      refundPlan = fullUser.plan;
      const refundConsumed = async () => {
        if (refunded) return;
        refunded = true;
        await refundApplyQuota(session.user.id, fullUser.plan);
        if (creditConsumed) await refundApplyCredit(session.user.id);
        if (freeReserved) await refundFreeSend(session.user.id);
      };

      let result: { success: boolean; messageId?: string; error?: string };

      if (hasGmail) {
        const g = fullUser.gmailAuth!;
        result = await sendViaGmail(
          { email: g.email, refreshToken: g.refreshToken },
          { from: `${fullUser.name || 'Applicant'} <${g.email}>`, to: app.appliedToEmail, replyTo: g.email, subject, html, text: coverLetter, attachmentBase64: cv?.base64, attachmentFilename: cv?.filename }
        );
        if (!result.success && result.error === 'gmail_token_invalid') {
          await prisma.gmailAuth.update({ where: { userId: session.user.id }, data: { verified: false, lastError: result.error } }).catch(() => {});
        }
      } else if (hasSmtp) {
        const smtp = fullUser.userSmtp!;
        result = await sendEmailViaSMTP(
          { host: smtp.host, port: smtp.port, email: smtp.email, password: smtp.password },
          { from: `${fullUser.name || 'Applicant'} <${smtp.email}>`, to: app.appliedToEmail, replyTo: smtp.email, subject, html, text: coverLetter, attachmentBase64: cv?.base64, attachmentFilename: cv?.filename }
        );
      } else {
        result = await sendAutoApplyViaPostal({
          userName: fullUser.name || 'Applicant',
          userEmail: fullUser.email,
          to: app.appliedToEmail,
          subject,
          html,
          text: coverLetter,
          applicationId: id,
          attachmentBase64: cv?.base64,
          attachmentFilename: cv?.filename,
        });
      }

      if (result.success) {
        sent = true; // email is out; from here a throw must not trigger a refund
        // The email is delivered — persist SENT reliably (retry a few times). If this write is lost, the
        // row keeps status REVIEW/PENDING/SENDING with sentAt=null and the send-now guard would let a
        // manual retry re-send it (double email) AND re-consume a credit (double charge). Retrying closes
        // that: once sentAt is set, the dupe check blocks any re-send.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await prisma.autoApplication.update({
              where: { id },
              data: { status: 'SENT', sentVia: hasGmail ? 'gmail' : hasSmtp ? 'smtp' : 'postal', coverLetter, subject, sentAt: new Date() },
            });
            break;
          } catch (e) {
            if (attempt === 2) console.error('[AutoApply] SENT write failed after retries (email WAS delivered):', (e as Error)?.message);
          }
        }
        // Increment sentToday
        if (app.loopId) {
          await prisma.autoApplyLoop.update({ where: { id: app.loopId }, data: { sentToday: { increment: 1 } } }).catch(() => {});
        }
        return NextResponse.json({ ok: true, message: 'Sent!', sentTo: app.appliedToEmail });
      } else {
        await refundConsumed(); // send failed — give the slots/credit back
        return NextResponse.json({ error: 'Send failed', message: result.error }, { status: 500 });
      }
    }

    if (action === 'skip') {
      if (!['PENDING', 'REVIEW', 'SENDING'].includes(app.status)) {
        return NextResponse.json({ error: 'Can only skip queued applications' }, { status: 400 });
      }
      await prisma.autoApplication.delete({ where: { id } });
      return NextResponse.json({ ok: true, message: 'Application removed from queue' });
    }

    if (action === 'update-draft') {
      const updateData: Record<string, string> = {};
      if (body.coverLetter) updateData.coverLetter = body.coverLetter;
      if (body.subject) updateData.subject = body.subject;
      if (Object.keys(updateData).length === 0) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      }
      await prisma.autoApplication.update({ where: { id }, data: updateData });
      return NextResponse.json({ ok: true });
    }

    if (action === 'edit-sequence') {
      await prisma.autoApplyLoop.update({
        where: { id: app.loopId },
        data: {
          ...(followUpDay1 !== undefined && { followUpDay1: parseInt(followUpDay1) }),
          ...(followUpDay2 !== undefined && { followUpDay2: parseInt(followUpDay2) }),
          ...(followUpEnabled !== undefined && { followUpEnabled }),
        },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[AutoApply Detail] POST error:', error);
    // Exception after the money-gate consume must not leak a paid credit / free slot / daily slot.
    if (refundUserId && !refunded && !sent) {
      refunded = true;
      await refundApplyQuota(refundUserId, refundPlan);
      if (creditConsumed) await refundApplyCredit(refundUserId);
      if (freeReserved) await refundFreeSend(refundUserId);
    }
    if ((error as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ error: 'already_applied', message: 'You already applied to this role.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
