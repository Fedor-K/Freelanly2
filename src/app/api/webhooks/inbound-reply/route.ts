import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/postal';
import OpenAI from 'openai';

function getAIClient() {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === 'zai') return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
  return { client: new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' }), model: 'deepseek-chat' };
}

async function categorizeReply(text: string): Promise<string> {
  try {
    const { client, model } = getAIClient();
    const r = await client.chat.completions.create({
      model, temperature: 0.1, max_tokens: 50,
      messages: [
        { role: 'system', content: 'Categorize this recruiter reply. Return ONE word:\n- INTERESTED = recruiter asks for resume, CV, portfolio, details, or shows any positive interest\n- INTERVIEW = recruiter wants to schedule a call, meeting, or interview\n- REJECTION = explicit rejection ("unfortunately", "not a fit", "position filled")\n- OTHER = automated reply, out of office, or unrelated' },
        { role: 'user', content: text.slice(0, 500) },
      ],
    });
    const cat = r.choices[0]?.message?.content?.trim().toUpperCase() || 'OTHER';
    if (cat.includes('INTERVIEW')) return 'INTERVIEW';
    if (cat.includes('REJECT')) return 'REJECTED';
    return 'REPLIED';
  } catch { return 'REPLIED'; }
}

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
        user: { select: { email: true, name: true, plan: true } },
      },
    });

    if (!app) {
      console.log(`[InboundReply] Application not found: ${appId}`);
      return NextResponse.json({ ok: true });
    }

    // Categorize reply with AI and update status
    const replyText = plainBody || htmlBody?.replace(/<[^>]*>/g, '') || '';
    const newStatus = replyText.length > 10 ? await categorizeReply(replyText) : 'REPLIED';

    if (app.status !== 'INTERVIEW' && app.status !== 'OFFER') {
      await prisma.autoApplication.update({
        where: { id: appId },
        data: {
          status: newStatus as any,
          replyText: replyText ? replyText.slice(0, 2000) : null,
          replyCategory: newStatus,
          repliedAt: new Date(),
        },
      });
      console.log(`[InboundReply] ${appId} → ${newStatus} from ${from}: ${replyText.slice(0, 80)}`);
    }

    // Forward reply to user's email
    // TODO: When paywall is enabled, FREE users get teaser instead of full reply
    // For now, forward to everyone
    const isPro = app.user.plan !== 'FREE';
    const paywallEnabled = false; // Set to true when ready to enable paywall

    if (!paywallEnabled || isPro) {
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
    } else {
      // FREE user with paywall: send teaser only
      try {
        await sendEmail({
          to: app.user.email,
          subject: `🔔 ${app.companyName} replied to your application!`,
          html: `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
            <h2 style="margin: 0 0 12px;">Great news — you got a reply!</h2>
            <p style="color: #555; line-height: 1.6;">A recruiter from <strong>${app.companyName}</strong> responded to your <strong>${app.jobTitle}</strong> application.</p>
            <div style="background: #f5f5f5; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
              <p style="color: #999; font-size: 14px; margin: 0 0 8px;">Reply preview is available for Pro members</p>
              <a href="https://freelanly.com/dashboard/auto-apply?tab=inbox" style="display: inline-block; padding: 12px 24px; background: #C7F94A; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600;">Read reply — Upgrade to Pro →</a>
            </div>
            <p style="color: #888; font-size: 13px;">Freelanly Pro: unlimited applies, read all replies, auto follow-ups — $29/mo</p>
          </div>`,
          text: `Great news! ${app.companyName} replied to your ${app.jobTitle} application. Upgrade to Pro to read the full reply: https://freelanly.com/pricing`,
        });
        console.log(`[InboundReply] Sent teaser to FREE user ${app.user.email}`);
      } catch (fwdErr) {
        console.error(`[InboundReply] Teaser failed:`, fwdErr);
      }
    }

    return NextResponse.json({ ok: true, appId, forwarded: !paywallEnabled || isPro });
  } catch (error) {
    console.error('[InboundReply] Error:', error);
    return NextResponse.json({ ok: true }); // Always 200 to prevent Postal retries
  }
}
