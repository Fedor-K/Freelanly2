import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/postal';

/**
 * POST /api/webhooks/inbound-reply
 * Postal sends inbound emails here when someone replies to reply+{appId}@reply.freelanly.com.
 * We: 1) mark application as REPLIED, 2) forward the email to the user.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Postal inbound webhook format
    const rcptTo = body.rcpt_to || body.to || '';
    const from = body.mail_from || body.from || '';
    const subject = body.subject || '';
    const plainBody = body.plain_body || body.text || '';
    const htmlBody = body.html_body || body.html || '';

    // Extract appId from reply+{appId}@reply.freelanly.com
    const match = rcptTo.match(/reply\+([a-z0-9]+)@/i);
    if (!match) {
      console.log(`[InboundReply] No appId in rcpt_to: ${rcptTo}`);
      return NextResponse.json({ ok: true });
    }

    const appId = match[1];

    // Find the application
    const app = await prisma.autoApplication.findUnique({
      where: { id: appId },
      select: {
        id: true,
        status: true,
        userId: true,
        jobTitle: true,
        companyName: true,
        user: { select: { email: true, name: true } },
      },
    });

    if (!app) {
      console.log(`[InboundReply] Application not found: ${appId}`);
      return NextResponse.json({ ok: true });
    }

    // Mark as REPLIED
    if (app.status !== 'REPLIED') {
      await prisma.autoApplication.update({
        where: { id: appId },
        data: { status: 'REPLIED' },
      });
      console.log(`[InboundReply] Marked ${appId} as REPLIED from ${from}`);
    }

    // Forward to user's email
    try {
      await sendEmail({
        to: app.user.email,
        subject: `Reply: ${subject || app.jobTitle} — ${app.companyName}`,
        html: htmlBody || `<pre>${plainBody}</pre>`,
        text: plainBody || 'You received a reply. Check the original in Freelanly dashboard.',
        replyTo: from,
      });
      console.log(`[InboundReply] Forwarded reply to ${app.user.email}`);
    } catch (fwdErr) {
      console.error(`[InboundReply] Forward failed:`, fwdErr);
    }

    return NextResponse.json({ ok: true, appId, forwarded: true });
  } catch (error) {
    console.error('[InboundReply] Error:', error);
    return NextResponse.json({ ok: true }); // Always 200 to prevent Postal retries
  }
}
