import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine } from '@/services/cover-letter-generator';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';

const FREE_DAILY_LIMIT = 5;

/**
 * POST /api/user/quick-apply
 * One-click apply to a specific opportunity from the project page.
 * Body: { opportunityId: string }
 * Returns: { success, coverLetter, subject } or error
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { opportunityId } = await request.json();
    if (!opportunityId) {
      return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
    }

    // Get user with SMTP and profile
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        plan: true,
        resumeText: true,
        parsedProfile: true,
        freeAppliesUsedToday: true,
        lastFreeApplyReset: true,
        userSmtp: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check SMTP
    if (!user.userSmtp?.verified) {
      return NextResponse.json({ error: 'smtp_required', message: 'Connect your email first to send applications.' }, { status: 400 });
    }

    // Check resume
    if (!user.resumeText && !user.parsedProfile) {
      return NextResponse.json({ error: 'resume_required', message: 'Upload your resume first.' }, { status: 400 });
    }

    // Check free daily limit
    if (user.plan === 'FREE') {
      const now = new Date();
      const lastReset = new Date(user.lastFreeApplyReset);
      const isNewDay = now.getUTCDate() !== lastReset.getUTCDate() ||
        now.getUTCMonth() !== lastReset.getUTCMonth() ||
        now.getUTCFullYear() !== lastReset.getUTCFullYear();

      const usedToday = isNewDay ? 0 : (user.freeAppliesUsedToday || 0);
      if (usedToday >= FREE_DAILY_LIMIT) {
        return NextResponse.json({
          error: 'limit_reached',
          message: `Daily limit reached (${FREE_DAILY_LIMIT}/${FREE_DAILY_LIMIT}). Upgrade to PRO for unlimited applies.`,
        }, { status: 429 });
      }
    }

    // Get opportunity
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: {
        id: true,
        title: true,
        description: true,
        clientName: true,
        applyEmail: true,
        category: { select: { slug: true } },
      },
    });

    if (!opportunity || !opportunity.applyEmail) {
      return NextResponse.json({ error: 'Opportunity not found or no email' }, { status: 404 });
    }

    // Check if already applied
    const existing = await prisma.autoApplication.findFirst({
      where: {
        userId: user.id,
        opportunityId: opportunity.id,
      },
    });

    if (existing) {
      return NextResponse.json({ error: 'already_applied', message: 'You already applied to this project.' }, { status: 409 });
    }

    // Generate cover letter
    const profile = user.parsedProfile as Record<string, unknown> | null;
    const coverLetter = await generateCoverLetter({
      jobTitle: opportunity.title,
      jobDescription: opportunity.description.slice(0, 800),
      companyName: opportunity.clientName,
      userProfile: {
        name: user.name || 'Applicant',
        skills: (profile?.skills as string[]) || [],
        experience: (user.resumeText || '').slice(0, 300),
        resumeText: user.resumeText || undefined,
      },
    });

    const subject = await generateSubjectLine({
      jobTitle: opportunity.title,
      userName: user.name || 'Applicant',
    });

    // Build HTML
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; font-size: 15px; line-height: 1.6;">
  ${coverLetter.split('\n').filter(p => p.trim()).map(p => `<p style="margin: 0 0 12px; line-height: 1.6;">${p}</p>`).join('')}
  <p style="margin: 24px 0 0;">Best regards,<br>${user.name || 'Applicant'}</p>
</body>
</html>`.trim();

    const text = `${coverLetter}\n\nBest regards,\n${user.name || 'Applicant'}`;

    // Send via SMTP
    const smtp = user.userSmtp!;
    const result = await sendEmailViaSMTP(
      { host: smtp.host, port: smtp.port, email: smtp.email, password: smtp.password },
      {
        from: `${user.name || 'Applicant'} <${smtp.email}>`,
        to: opportunity.applyEmail,
        replyTo: smtp.email,
        subject,
        html,
        text,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: 'send_failed', message: result.error }, { status: 500 });
    }

    // Create AutoApplication record
    // Find or create a loop for this user
    let loop = await prisma.autoApplyLoop.findFirst({
      where: { userId: user.id },
    });

    if (!loop) {
      loop = await prisma.autoApplyLoop.create({
        data: {
          userId: user.id,
          name: 'Quick Apply',
          jobTitles: [],
          dailyLimit: user.plan === 'FREE' ? FREE_DAILY_LIMIT : 30,
          mode: 'MANUAL',
          isActive: false,
        },
      });
    }

    await prisma.autoApplication.create({
      data: {
        userId: user.id,
        loopId: loop.id,
        opportunityId: opportunity.id,
        companyName: opportunity.clientName,
        jobTitle: opportunity.title,
        appliedToEmail: opportunity.applyEmail,
        coverLetter,
        subject,
        status: 'SENT',
        sentVia: 'smtp',
        sentAt: new Date(),
      },
    });

    // Increment free applies counter
    if (user.plan === 'FREE') {
      const now = new Date();
      const lastReset = new Date(user.lastFreeApplyReset);
      const isNewDay = now.getUTCDate() !== lastReset.getUTCDate() ||
        now.getUTCMonth() !== lastReset.getUTCMonth() ||
        now.getUTCFullYear() !== lastReset.getUTCFullYear();

      await prisma.user.update({
        where: { id: user.id },
        data: {
          freeAppliesUsedToday: isNewDay ? 1 : { increment: 1 },
          lastFreeApplyReset: isNewDay ? now : undefined,
        },
      });
    }

    return NextResponse.json({
      success: true,
      coverLetter,
      subject,
      sentTo: opportunity.applyEmail,
    });
  } catch (error) {
    console.error('[QuickApply] Error:', error);
    return NextResponse.json({ error: 'Failed to apply' }, { status: 500 });
  }
}
