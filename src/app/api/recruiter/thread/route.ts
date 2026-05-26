import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';
import { cleanReplyText } from '@/lib/clean-reply';

/**
 * GET /api/recruiter/thread?token=&appId= — full conversation for one application, for the
 * recruiter portal chat view. Returns every message (candidate + recruiter, both email- and
 * portal-originated, since both write to Message) in order. Authed by signed token; the
 * recruiter may only read threads for applications addressed to their email.
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token') || '';
    const appId = url.searchParams.get('appId') || '';
    const email = verifyRecruiterToken(token);
    if (!email) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 });
    if (!appId) return NextResponse.json({ error: 'appId required' }, { status: 400 });

    const app = await prisma.autoApplication.findUnique({
      where: { id: appId },
      select: {
        appliedToEmail: true, coverLetter: true, replyText: true, sentAt: true, repliedAt: true,
        messages: { orderBy: { createdAt: 'asc' }, select: { from: true, text: true, createdAt: true } },
      },
    });
    if (!app || (app.appliedToEmail || '').toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Clean inbound-email cruft (quoted history, signatures) so each message reads like a
    // chat bubble. No-op on composed/portal messages.
    let thread = app.messages.map((m) => ({ from: m.from, text: cleanReplyText(m.text), at: m.createdAt.toISOString() }));
    // Fallback for apps that predate the Message log: synthesize from cover letter + reply.
    if (thread.length === 0) {
      if (app.coverLetter) thread.push({ from: 'user', text: cleanReplyText(app.coverLetter), at: (app.sentAt || new Date()).toISOString() });
      if (app.replyText) thread.push({ from: 'recruiter', text: cleanReplyText(app.replyText), at: (app.repliedAt || new Date()).toISOString() });
    }
    return NextResponse.json({ thread: thread.filter((m) => m.text) });
  } catch (e) {
    console.error('[RecruiterThread] error:', e);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
