import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine } from '@/services/cover-letter-generator';

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
      const toneOverride = tone ? `Write in a ${tone} tone. ` : '';
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
        styleOverride: toneOverride ? `${toneOverride}Write a 3-5 sentence cover letter body. Be professional and specific. ONLY mention skills the applicant actually has. No greeting or signature. Under 150 words.` : undefined,
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

    if (action === 'send-now') {
      // Change status to PENDING so the worker picks it up immediately
      // (or SENDING if we want instant processing)
      if (!['PENDING', 'REVIEW', 'SENDING'].includes(app.status)) {
        return NextResponse.json({ error: 'Can only send queued applications' }, { status: 400 });
      }
      await prisma.autoApplication.update({
        where: { id },
        data: { status: 'PENDING' }, // Worker will pick it up on next run
      });
      return NextResponse.json({ ok: true, message: 'Queued for immediate send' });
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
