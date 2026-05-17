import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine } from '@/services/cover-letter-generator';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { buildApplicationEmailHtml } from '@/services/auto-apply-processor';

function cleanReplyText(text: string | null): string | null {
  if (!text) return null;
  let clean = text
    .replace(/--[0-9a-fA-F]{20,}\s*/g, '')
    .replace(/--[a-zA-Z0-9_=.-]{10,}--?\s*/g, '')
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
  const quoteIdx = clean.search(/\n\s*On .{10,80} wrote:\s*$/m);
  if (quoteIdx > 20) clean = clean.slice(0, quoteIdx).trim();
  const fromIdx = clean.search(/\n\s*From: .{5,80}\n\s*Sent:/m);
  if (fromIdx > 20) clean = clean.slice(0, fromIdx).trim();
  const sentFromIdx = clean.search(/\n\s*Sent from (my iPhone|my iPad|Mail for Windows|Samsung|Proton Mail|Yahoo Mail)/im);
  if (sentFromIdx > 20) clean = clean.slice(0, sentFromIdx).trim();
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
          select: { id: true, title: true, company: { select: { name: true } }, salaryText: true },
          take: 3,
          orderBy: { createdAt: 'desc' },
        })
      : [];

    // Follow-up schedule
    const followUpSchedule = app.loop.followUpEnabled ? [
      { touch: 1, day: 0, label: 'Initial outreach', status: app.sentAt ? 'sent' : 'pending', date: app.sentAt },
      { touch: 2, day: app.loop.followUpDay1, label: 'Soft bump if no reply', status: app.followUpSentAt ? 'sent' : 'scheduled', date: app.sentAt ? new Date(app.sentAt.getTime() + app.loop.followUpDay1 * 86400000) : null },
      { touch: 3, day: app.loop.followUpDay2, label: 'Final breakup email', status: 'scheduled', date: app.sentAt ? new Date(app.sentAt.getTime() + app.loop.followUpDay2 * 86400000) : null },
    ] : [];

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
      similar: similar.map(s => ({ id: s.id, title: s.title, company: s.company?.name, salary: s.salaryText })),
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

      // Fetch full user data for sending
      const fullUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, plan: true, userSmtp: true },
      });
      if (!fullUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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

      const html = buildApplicationEmailHtml({
        coverLetter,
        userName: fullUser.name || 'Applicant',
        jobTitle: app.jobTitle,
        companyName: app.companyName,
        recruiterName: '',
        applicationId: id,
      });

      const hasSmtp = !!fullUser.userSmtp?.verified;
      let result: { success: boolean; messageId?: string; error?: string };

      if (hasSmtp) {
        const smtp = fullUser.userSmtp!;
        result = await sendEmailViaSMTP(
          { host: smtp.host, port: smtp.port, email: smtp.email, password: smtp.password },
          { from: `${fullUser.name || 'Applicant'} <${smtp.email}>`, to: app.appliedToEmail, replyTo: smtp.email, subject, html, text: coverLetter }
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
        });
      }

      if (result.success) {
        await prisma.autoApplication.update({
          where: { id },
          data: { status: 'SENT', sentVia: hasSmtp ? 'smtp' : 'postal', coverLetter, subject, sentAt: new Date() },
        });
        // Increment sentToday
        if (app.loopId) {
          await prisma.autoApplyLoop.update({ where: { id: app.loopId }, data: { sentToday: { increment: 1 } } }).catch(() => {});
        }
        return NextResponse.json({ ok: true, message: 'Sent!', sentTo: app.appliedToEmail });
      } else {
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
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
