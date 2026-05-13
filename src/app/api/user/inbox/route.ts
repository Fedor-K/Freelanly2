import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import OpenAI from 'openai';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';

function getAIClient() {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === 'zai') return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
  return { client: new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' }), model: 'deepseek-chat' };
}

/**
 * GET /api/user/inbox — list replied applications with thread data
 * POST /api/user/inbox — send reply to recruiter
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });
    const isPro = user?.plan !== 'FREE';

    const filter = request.nextUrl.searchParams.get('filter') || 'all';

    const where: Record<string, unknown> = {
      userId: session.user.id,
      status: { in: ['REPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] },
    };

    if (filter === 'interested') where.status = 'REPLIED';
    if (filter === 'interview') where.status = 'INTERVIEW';
    if (filter === 'rejected') where.status = 'REJECTED';

    const threads = await prisma.autoApplication.findMany({
      where: where as any,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        companyName: true,
        jobTitle: true,
        appliedToEmail: true,
        coverLetter: true,
        subject: true,
        status: true,
        matchScore: true,
        matchLabel: true,
        sentAt: true,
        followUpSentAt: true,
        replyText: true,
        replyCategory: true,
        repliedAt: true,
        updatedAt: true,
      },
    });

    const enriched = threads.map(t => {
      // FREE users: blur reply text, show teaser
      const replyText = isPro ? t.replyText : (t.replyText ? t.replyText.slice(0, 30) + '...' : null);
      const locked = !isPro && !!t.replyText;

      return {
        ...t,
        replyText,
        locked,
        thread: [
          { from: 'you', text: t.coverLetter, date: t.sentAt },
          ...(t.followUpSentAt ? [{ from: 'you', text: '(Follow-up sent)', date: t.followUpSentAt }] : []),
          ...(t.replyText ? [{ from: 'recruiter', text: isPro ? t.replyText : '🔒 Upgrade to Pro to read this reply', date: t.repliedAt || t.updatedAt }] : []),
        ],
      };
    });

    return NextResponse.json({ threads: enriched, total: enriched.length });
  } catch (error) {
    console.error('[Inbox] GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * POST /api/user/inbox — send reply OR get AI suggested reply
 * Body: { applicationId, action: 'suggest' | 'send', message?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { applicationId, action, message } = await request.json();

    const app = await prisma.autoApplication.findFirst({
      where: { id: applicationId, userId: session.user.id },
      include: {
        user: { select: { name: true, email: true, userSmtp: true } },
      },
    });

    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // AI Suggested Reply
    if (action === 'suggest') {
      const replyText = app.replyText || '';
      const { client, model } = getAIClient();

      const response = await client.chat.completions.create({
        model,
        temperature: 0.6,
        max_tokens: 200,
        messages: [
          { role: 'system', content: 'Write a short, professional reply to a recruiter. 2-3 sentences max. No greeting or signature.' },
          { role: 'user', content: `Recruiter message: "${replyText.slice(0, 300)}"\nOriginal application was for: ${app.jobTitle} at ${app.companyName}\nYour name: ${app.user.name}` },
        ],
      });

      const suggested = response.choices[0]?.message?.content?.trim() || 'Thank you for your response. I would be happy to discuss further.';

      return NextResponse.json({
        suggested,
        full: `Dear ${app.companyName.split(' ')[0]},\n\n${suggested}\n\nBest regards,\n${app.user.name}\n${app.user.email}`,
      });
    }

    // Send Reply
    if (action === 'send' && message) {
      const subject = `Re: ${app.subject}`;
      const html = `<div style="font-family: sans-serif; font-size: 15px; line-height: 1.6; color: #333;">
        ${message.split('\n').map((p: string) => `<p style="margin: 0 0 12px;">${p}</p>`).join('')}
      </div>`;

      let result;
      const hasSmtp = !!app.user.userSmtp?.verified;

      if (hasSmtp) {
        const smtp = app.user.userSmtp!;
        result = await sendEmailViaSMTP(
          { host: smtp.host, port: smtp.port, email: smtp.email, password: smtp.password },
          { from: `${app.user.name} <${smtp.email}>`, to: app.appliedToEmail, replyTo: smtp.email, subject, html, text: message }
        );
      } else {
        result = await sendAutoApplyViaPostal({
          userName: app.user.name || 'Applicant',
          userEmail: app.user.email,
          to: app.appliedToEmail,
          subject,
          html,
          text: message,
          applicationId: app.id,
        });
      }

      if (result.success) {
        return NextResponse.json({ success: true, sentTo: app.appliedToEmail });
      } else {
        return NextResponse.json({ error: 'send_failed', message: result.error }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Inbox] POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
