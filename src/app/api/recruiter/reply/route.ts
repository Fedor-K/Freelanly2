import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';
import { sendEmail } from '@/lib/email';

/**
 * POST /api/recruiter/reply — recruiter replies to a candidate from the portal (/r/[token]).
 * Routed on-platform: creates a recruiter Message, marks the application REPLIED, and
 * notifies the candidate (who reads it on their dashboard). The recruiter is authenticated
 * by the signed token and may only reply to applications sent to their own email.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, applicationId, message } = await request.json();
    const email = verifyRecruiterToken(token || '');
    if (!email) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 });
    if (!applicationId || !message || !String(message).trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    const app = await prisma.autoApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true, appliedToEmail: true, companyName: true, jobTitle: true, status: true, userId: true,
        user: { select: { email: true, name: true, notifyOnReply: true } },
      },
    });
    // Authorization: recruiter can only reply to applications addressed to them.
    if (!app || (app.appliedToEmail || '').toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const text = String(message).trim().slice(0, 2000);

    // Dedup identical sends within 60s (double-click / retry).
    const dup = await prisma.message.findFirst({
      where: { applicationId, from: 'recruiter', text, createdAt: { gte: new Date(Date.now() - 60000) } },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ success: true, note: 'already_sent' });

    await prisma.message.create({ data: { applicationId, from: 'recruiter', text } });

    // Mark replied (never downgrade an INTERVIEW/OFFER).
    if (app.status !== 'INTERVIEW' && app.status !== 'OFFER') {
      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: { status: 'REPLIED', replyText: text, replyCategory: 'REPLIED', repliedAt: new Date() },
      });
    }

    // Notify the candidate — they read the full message on their dashboard inbox.
    if (app.user.notifyOnReply !== false && app.user.email) {
      const firstName = app.user.name?.split(' ')[0] || 'there';
      const preview = text.replace(/\s+/g, ' ').slice(0, 140);
      await sendEmail({
        to: app.user.email,
        subject: `${app.companyName} replied to your application!`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
          <h2 style="margin:0 0 8px">Hey ${firstName}, you got a reply! 🎉</h2>
          <p style="color:#555;margin:0 0 16px;line-height:1.6">A recruiter responded to your application for <strong>${app.jobTitle}</strong>.</p>
          <table style="width:100%;border:1px solid #E8E5DC;border-radius:10px;border-collapse:collapse"><tr><td style="padding:14px 16px;color:#444;font-size:14px;line-height:1.5">${preview}${text.length > 140 ? '…' : ''}</td></tr></table>
          <div style="margin-top:20px;text-align:center"><a href="https://freelanly.com/dashboard/inbox" style="display:inline-block;padding:12px 28px;background:#C7F94A;color:#000;border-radius:10px;text-decoration:none;font-weight:600">View &amp; reply →</a></div>
        </div>`,
        text: `${app.companyName} replied: ${preview} — View: https://freelanly.com/dashboard/inbox`,
      }).catch(() => {});
    }

    await prisma.activityLog.create({
      data: { userId: app.userId, action: 'RECRUITER_REPLIED', details: { applicationId, source: 'recruiter_portal', company: app.companyName } },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[RecruiterReply] error:', e);
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
  }
}
