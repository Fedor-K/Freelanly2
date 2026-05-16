import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine } from '@/services/cover-letter-generator';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';

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

    const body = await request.json();
    const { opportunityId, jobId, editedCoverLetter, editedSubject, draftOnly, coverLetter: providedCoverLetter, subject: providedSubject } = body;
    if (!opportunityId && !jobId) {
      return NextResponse.json({ error: 'opportunityId or jobId required' }, { status: 400 });
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

    const hasSmtp = !!user.userSmtp?.verified;

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
        clientType: true,
        posterCompany: true,
        applyEmail: true,
        category: { select: { slug: true } },
        company: { select: { name: true } },
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

    // Resolve company name vs recruiter name
    const emailDomain = opportunity.applyEmail?.split('@')[1] || '';
    const isCorpEmail = emailDomain && !['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','aol.com','icloud.com','mail.com','protonmail.com','yandex.com','zoho.com'].includes(emailDomain);
    const companyFromDomain = isCorpEmail ? emailDomain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

    const companyName = opportunity.company?.name
      || opportunity.posterCompany
      || (opportunity.clientType === 'company' ? opportunity.clientName : null)
      || companyFromDomain
      || 'the hiring team';

    // Extract recruiter name: from clientName or from email local part
    let recruiterName = '';
    if (opportunity.clientType === 'profile' && opportunity.clientName) {
      recruiterName = opportunity.clientName.split(' ')[0];
    } else if (opportunity.applyEmail) {
      const localPart = opportunity.applyEmail.split('@')[0];
      // Extract first name from email like nishtha.saretha or john_doe
      const namePart = localPart.split(/[._-]/)[0];
      if (namePart.length >= 3 && namePart !== 'info' && namePart !== 'hr' && namePart !== 'careers' && namePart !== 'jobs' && namePart !== 'hiring' && namePart !== 'recruit' && namePart !== 'admin' && namePart !== 'contact' && namePart !== 'hello' && namePart !== 'apply' && namePart !== 'support') {
        recruiterName = namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase();
      }
    }

    // Use provided text or generate new
    let coverLetter: string;
    if (providedCoverLetter || editedCoverLetter) {
      coverLetter = providedCoverLetter || editedCoverLetter;
    } else {
      const profile = user.parsedProfile as Record<string, unknown> | null;
      coverLetter = await generateCoverLetter({
        jobTitle: opportunity.title,
        jobDescription: opportunity.description.slice(0, 800),
        companyName,
        userProfile: {
          name: user.name || 'Applicant',
          skills: (profile?.skills as string[]) || [],
          experience: (user.resumeText || '').slice(0, 300),
          resumeText: user.resumeText || undefined,
          recruiterEmail: opportunity.applyEmail,
        } as any,
      });
    }

    const subject = providedSubject || editedSubject || await generateSubjectLine({
      jobTitle: opportunity.title,
      userName: user.name || 'Applicant',
    });

    // Draft-only mode: AI generates complete email (greeting + body + signature)
    if (draftOnly) {
      return NextResponse.json({ ok: true, coverLetter, subject, to: opportunity.applyEmail });
    }

    // Build full letter with greeting and signature
    const greeting = recruiterName ? `Hi ${recruiterName}` : 'Hi there';
    const replyEmail = user.userSmtp?.email || user.email;
    const signature = `Best regards,\n${user.name || 'Applicant'}\n${replyEmail}`;
    const fullLetter = `${greeting}\n\n${coverLetter}\n\n${signature}`;

    // Build HTML
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #333; font-size: 15px; line-height: 1.6;">
  <p style="margin: 0 0 12px;">${greeting}</p>
  ${coverLetter.split('\n').filter(p => p.trim()).map(p => `<p style="margin: 0 0 12px; line-height: 1.6;">${p}</p>`).join('')}
  <p style="margin: 24px 0 0;">Best regards,<br>${user.name || 'Applicant'}<br><span style="color: #666; font-size: 14px;">${replyEmail}</span></p>
</body>
</html>`.trim();

    const text = fullLetter;

    // Send via user's SMTP or Postal
    let result: { success: boolean; messageId?: string; error?: string };

    if (hasSmtp) {
      const smtp = user.userSmtp!;
      result = await sendEmailViaSMTP(
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
    } else {
      // Create application record FIRST to get ID for reply routing
      let loop = await prisma.autoApplyLoop.findFirst({ where: { userId: user.id } });
      if (!loop) {
        loop = await prisma.autoApplyLoop.create({
          data: { userId: user.id, name: 'Quick Apply', jobTitles: [], dailyLimit: 50, mode: 'MANUAL', isActive: false },
        });
      }
      const appRecord = await prisma.autoApplication.create({
        data: {
          userId: user.id, loopId: loop.id, opportunityId: opportunity.id,
          companyName: opportunity.clientName, jobTitle: opportunity.title,
          appliedToEmail: opportunity.applyEmail, coverLetter, subject,
          status: 'SENDING', sentVia: 'postal',
        },
      });

      result = await sendAutoApplyViaPostal({
        userName: user.name || 'Applicant',
        userEmail: user.email,
        to: opportunity.applyEmail,
        subject,
        html,
        text,
        applicationId: appRecord.id,
      });

      if (result.success) {
        await prisma.autoApplication.update({
          where: { id: appRecord.id },
          data: { status: 'SENT', sentAt: new Date() },
        });
      } else {
        await prisma.autoApplication.update({
          where: { id: appRecord.id },
          data: { status: 'FAILED', errorMessage: result.error?.slice(0, 500) },
        });
        return NextResponse.json({ error: 'send_failed', message: result.error }, { status: 500 });
      }

      return NextResponse.json({ success: true, coverLetter: fullLetter, subject, sentTo: opportunity.applyEmail });
    }

    if (!result.success) {
      return NextResponse.json({ error: 'send_failed', message: result.error }, { status: 500 });
    }

    // Create AutoApplication record for SMTP users
    let loop = await prisma.autoApplyLoop.findFirst({
      where: { userId: user.id },
    });

    if (!loop) {
      loop = await prisma.autoApplyLoop.create({
        data: {
          userId: user.id,
          name: 'Quick Apply',
          jobTitles: [],
          dailyLimit: 50,
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
      coverLetter: fullLetter,
      subject,
      sentTo: opportunity.applyEmail,
    });
  } catch (error) {
    console.error('[QuickApply] Error:', error);
    return NextResponse.json({ error: 'Failed to apply' }, { status: 500 });
  }
}
