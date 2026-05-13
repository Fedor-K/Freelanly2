import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/postal';
import OpenAI from 'openai';
import { replyNotificationEmail, replyTeaserEmail } from '@/lib/email-templates';

function getAIClient() {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === 'zai') return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
  return { client: new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' }), model: 'deepseek-chat' };
}

async function extractSignal(text: string, jobTitle: string, companyName: string): Promise<string> {
  try {
    const { client, model } = getAIClient();
    const r = await client.chat.completions.create({
      model, temperature: 0.1, max_tokens: 100,
      messages: [
        { role: 'system', content: 'Extract the key signal from this recruiter reply in ONE sentence. Include: their intent (interested/scheduling/requesting info/rejecting), any specific action items (proposed time, requested documents), and any caveats. Be factual and concise. Example: "Interested and proposed a call Tuesday 3pm CET. Caveat: role is full-time, not contract."' },
        { role: 'user', content: `Job: ${jobTitle} at ${companyName}\nReply: ${text.slice(0, 500)}` },
      ],
    });
    return r.choices[0]?.message?.content?.trim() || '';
  } catch { return ''; }
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
        user: { select: { email: true, name: true, plan: true, notifySlackUrl: true, notifyOnReply: true } },
      },
    });

    if (!app) {
      console.log(`[InboundReply] Application not found: ${appId}`);
      return NextResponse.json({ ok: true });
    }

    // Categorize reply + extract AI signal
    const replyText = plainBody || htmlBody?.replace(/<[^>]*>/g, '') || '';
    const newStatus = replyText.length > 10 ? await categorizeReply(replyText) : 'REPLIED';
    const signal = replyText.length > 10 ? await extractSignal(replyText, app.jobTitle, app.companyName) : '';

    if (app.status !== 'INTERVIEW' && app.status !== 'OFFER') {
      await prisma.autoApplication.update({
        where: { id: appId },
        data: {
          status: newStatus as any,
          replyText: replyText ? replyText.slice(0, 2000) : null,
          replyCategory: newStatus,
          replySignal: signal || null,
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
      // PRO: branded reply notification with full content
      try {
        const branded = replyNotificationEmail({
          userName: app.user.name || 'there',
          recruiterName: from.split('<')[0].trim() || app.companyName,
          company: app.companyName,
          jobTitle: app.jobTitle,
          replyPreview: replyText.slice(0, 200),
          replySignal: signal,
          category: newStatus,
          sentAgo: 'just now',
        });
        await sendEmail({ to: app.user.email, subject: branded.subject, html: branded.html, text: branded.text, replyTo: from });
        console.log(`[InboundReply] Branded reply email sent to ${app.user.email}`);
      } catch (fwdErr) {
        console.error(`[InboundReply] Forward failed:`, fwdErr);
      }
    } else {
      // FREE: branded teaser (no full text)
      try {
        const teaser = replyTeaserEmail({
          userName: app.user.name || 'there',
          recruiterName: from.split('<')[0].trim() || app.companyName,
          company: app.companyName,
          jobTitle: app.jobTitle,
          replySignal: signal,
          category: newStatus,
        });
        await sendEmail({ to: app.user.email, subject: teaser.subject, html: teaser.html, text: teaser.text });
        console.log(`[InboundReply] Branded teaser sent to FREE user ${app.user.email}`);
      } catch (fwdErr) {
        console.error(`[InboundReply] Teaser failed:`, fwdErr);
      }
    }

    // Slack notification
    if (app.user.notifySlackUrl && app.user.notifyOnReply) {
      try {
        await fetch(app.user.notifySlackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            blocks: [
              { type: 'section', text: { type: 'mrkdwn', text: `*New reply from ${app.companyName}* — ${app.jobTitle}` } },
              { type: 'section', text: { type: 'mrkdwn', text: signal ? `> ${signal}` : `> ${replyText.slice(0, 100)}...` } },
              { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open in Freelanly' }, url: 'https://freelanly.com/dashboard/auto-apply?tab=inbox' }] },
            ],
          }),
        });
        console.log(`[InboundReply] Slack notified for ${app.user.email}`);
      } catch (slackErr) {
        console.error(`[InboundReply] Slack failed:`, slackErr);
      }
    }

    return NextResponse.json({ ok: true, appId, forwarded: !paywallEnabled || isPro });
  } catch (error) {
    console.error('[InboundReply] Error:', error);
    return NextResponse.json({ ok: true }); // Always 200 to prevent Postal retries
  }
}
