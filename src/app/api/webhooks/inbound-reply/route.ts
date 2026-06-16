import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { escapeHtml } from '@/lib/html-escape';
import { isScamReply } from '@/lib/scam-filter';
import { isFreeEmailProvider } from '@/lib/content-quality';
import { sendTelegramNotification, formatReplyNotification } from '@/lib/telegram-notify';
import OpenAI from 'openai';
import { replyNotificationEmail, replyTeaserEmail } from '@/lib/email-templates';
import { maybeSendRecruiterShortlistNudge } from '@/lib/recruiter-nudge';

function getAIClient() {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === 'zai') return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
  return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
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
        { role: 'system', content: 'Categorize this recruiter reply. Return ONE word:\n- INTERVIEW = recruiter CONCRETELY moves to a call/interview: proposes a specific time, asks for your availability, or says to book/schedule a call or interview. Do NOT use INTERVIEW for "thank you for applying", a vague "we will be in touch" / "let us discuss", or just "share your CV".\n- INTERESTED = asks for resume/CV/portfolio/details, or shows positive interest WITHOUT concretely proposing a call.\n- REJECTION = explicit rejection ("unfortunately", "not a fit", "position filled").\n- SPAM = unpaid internship, no compensation, volunteer work, TMDA/captcha verification ("verify that you are"), out of office auto-reply, mass template collecting resumes without a specific job, delivery failure/bounce, OR asking you to PAY for a resume rewrite/review/service.\n- OTHER = unrelated or unclear.\nWhen unsure between INTERVIEW and INTERESTED, choose INTERESTED.' },
        { role: 'user', content: text.slice(0, 500) },
      ],
    });
    const cat = r.choices[0]?.message?.content?.trim().toUpperCase() || 'OTHER';
    if (cat.includes('SPAM')) return 'SPAM';
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
    // Verify a shared secret when configured (set POSTAL_WEBHOOK_SECRET + pass it
    // as ?secret= or x-webhook-secret from Postal). No-op until configured.
    const inboundSecret = process.env.POSTAL_WEBHOOK_SECRET;
    if (inboundSecret) {
      const got = request.headers.get('x-webhook-secret')
        || new URL(request.url).searchParams.get('secret');
      if (got !== inboundSecret) {
        return NextResponse.json({ ok: true });
      }
    }

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
        appliedToEmail: true,
        replyUnlocked: true,
        user: { select: { email: true, name: true, plan: true, notifySlackUrl: true, notifyOnReply: true, telegramChatId: true, freeReplyUsed: true } },
      },
    });

    if (!app) {
      console.log(`[InboundReply] Application not found: ${appId}`);
      return NextResponse.json({ ok: true });
    }

    // Try multiple body fields (Postal may use different formats)
    const rawBody = plainBody || htmlBody?.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&') || body.body || body.content || body.message || '';
    const replyText = rawBody.trim();
    if (!replyText) {
      console.log(`[InboundReply] Empty body for ${appId}. Keys: ${Object.keys(body).join(', ')}`);
    }

    // Direction check. The application's recruiter notification routes recruiter
    // replies here, but the notification email we send the USER also has its
    // Reply-To set to reply+{appId}@ — so if the user hits "Reply" in their inbox
    // the message lands here too. Forward it to the recruiter via apply@ (same as
    // a dashboard reply) so the whole conversation stays on-platform and the
    // user's real address is never exposed.
    const senderEmail = (from.match(/<([^>]+)>/)?.[1] || from).toLowerCase().trim();
    if (senderEmail && senderEmail === app.user.email?.toLowerCase().trim()) {
      // Send-paywall (mirror of /api/user/inbox): the OUTBOUND reply is the gated action.
      // PRO unlimited; first reply free; after that the thread must be unlocked (paid) to forward.
      const PW_ON = process.env.REPLY_PAYWALL === 'on';
      const isFree = app.user.plan === 'FREE';
      let grantFree = false;
      if (PW_ON && isFree && !app.replyUnlocked) {
        if (app.user.freeReplyUsed) {
          // Locked: do not forward the user's email reply; they must unlock it in the dashboard.
          console.log(`[InboundReply] User email-reply for ${appId} is send-locked — not forwarded (pay required)`);
          return NextResponse.json({ ok: true, appId, sendLocked: true });
        }
        grantFree = true;
      }
      if (replyText && app.appliedToEmail) {
        const fwd = await sendAutoApplyViaPostal({
          userName: app.user.name || 'Applicant',
          userEmail: app.user.email,
          to: app.appliedToEmail,
          subject: /^re:/i.test(subject) ? subject : `Re: ${app.jobTitle}`,
          html: escapeHtml(replyText).replace(/\n/g, '<br>'),
          text: replyText,
          applicationId: app.id,
        });
        if (fwd.success) {
          await prisma.message.create({
            data: { applicationId: app.id, from: 'user', text: replyText.slice(0, 2000) },
          }).catch(() => {});
          await prisma.activityLog.create({
            data: { userId: app.userId, action: 'INBOX_REPLY_SENT', details: { applicationId: app.id, to: app.appliedToEmail, company: app.companyName, source: 'email_reply' } },
          }).catch(() => {});
          if (grantFree) {
            // Spend the one free outbound credit and unlock this thread for future replies.
            await prisma.user.update({ where: { id: app.userId }, data: { freeReplyUsed: true } }).catch(() => {});
            await prisma.autoApplication.update({ where: { id: app.id }, data: { replyUnlocked: true } }).catch(() => {});
          }
          console.log(`[InboundReply] User email-reply forwarded to recruiter for ${appId}`);
        } else {
          console.error(`[InboundReply] Failed to forward user reply for ${appId}: ${fwd.error}`);
        }
      }
      return NextResponse.json({ ok: true, appId, forwarded: true });
    }

    // Predatory resume-rewrite "recruiters": treat exactly like SPAM — don't notify the
    // user, don't mark the app replied, don't count it as a reply.
    if (isScamReply(from, replyText)) {
      console.log(`[InboundReply] Scam reply filtered for ${appId} from ${from}: ${replyText.slice(0, 80)}`);
      return NextResponse.json({ ok: true, appId, scam: true });
    }

    // Free-domain demand is dropped (decision 2026-06): import/match/send already block it, but
    // ~5.7k applications sent BEFORE the cutoff still receive "replies" — audit showed these are
    // résumé-farm auto-responders (mass templates weeks later, salary/PII harvesting), 20% of
    // weekly inbound. Drop them like SPAM. Threads the user already advanced to INTERVIEW/OFFER
    // are spared — those few conversations are real enough to let the user decide.
    if (isFreeEmailProvider(app.appliedToEmail) && app.status !== 'INTERVIEW' && app.status !== 'OFFER') {
      console.log(`[InboundReply] Free-domain thread reply dropped for ${appId} from ${from}`);
      return NextResponse.json({ ok: true, appId, freeDomainDropped: true });
    }

    const newStatus = replyText.length > 10 ? await categorizeReply(replyText) : 'REPLIED';

    // SPAM replies: log and skip — don't notify user, don't change status
    if (newStatus === 'SPAM') {
      console.log(`[InboundReply] SPAM filtered for ${appId} from ${from}: ${replyText.slice(0, 80)}`);
      return NextResponse.json({ ok: true, appId, spam: true });
    }

    const signal = replyText.length > 10 ? await extractSignal(replyText, app.jobTitle, app.companyName) : '';

    // PAYWALL moved to SENDING (decision 2026-06-16): reading a recruiter reply is ALWAYS free.
    // We never lock the read or consume the free credit here. `replyUnlocked` only seeds whether
    // SENDING is already open: PRO and paywall-off → open (true); FREE with paywall on →
    // send-locked (false) until the user spends their one free reply or pays $5 (enforced at send
    // time in /api/user/inbox). Cold REJECTED threads are always open (nothing to gate).
    const PAYWALL_ON = process.env.REPLY_PAYWALL === 'on';
    const isProUser = app.user.plan !== 'FREE';
    const isColdReply = newStatus === 'REJECTED';
    const sendOpen = !PAYWALL_ON || isProUser || isColdReply;
    const lockReply = false; // reading is never locked anymore — full notification always

    if (app.status !== 'INTERVIEW' && app.status !== 'OFFER') {
      await prisma.autoApplication.update({
        where: { id: appId },
        data: {
          status: newStatus as any,
          replyText: replyText ? replyText.slice(0, 2000) : null,
          replyCategory: newStatus,
          replySignal: signal || null,
          repliedAt: new Date(),
          replyUnlocked: sendOpen,
        },
      });
      // Save to message thread
      await prisma.message.create({
        data: { applicationId: appId, from: 'recruiter', text: replyText.slice(0, 2000) },
      }).catch(() => {});
      console.log(`[InboundReply] ${appId} → ${newStatus} from ${from}: ${replyText.slice(0, 80)}`);

      // Track engagement event
      await prisma.activityLog.create({
        data: { userId: app.userId, action: 'RECRUITER_REPLIED', details: { applicationId: appId, category: newStatus, source: 'postal_webhook' } },
      }).catch(() => {});
    }

    // Lever #1 — pull the recruiter into the portal with their full shortlist at peak intent.
    // Reached only on a genuine recruiter reply (user-direction/scam/spam already returned above).
    // Fire-and-forget; the helper rate-limits (1/recruiter/14d), honors opt-out, skips free inboxes.
    void maybeSendRecruiterShortlistNudge({
      recruiterEmail: app.appliedToEmail || '',
      jobTitle: app.jobTitle,
      candidateName: app.user.name || 'your candidate',
      applicationId: appId,
      category: newStatus,
    });

    // Tiered notifications — kill fatigue, amplify hot leads:
    //  • INTERVIEW (hot)  → email + Telegram (if connected) + Slack
    //  • REPLIED (actionable: "send your CV", rate, etc.) → email (+ Slack)
    //  • REJECTED (cold)  → SILENT: status is updated, but no interruption
    // (analysis: users were notified on every reply incl. rejections → tuned out →
    //  63% never even opened genuine interview invites)
    const notify = app.user.notifyOnReply !== false;
    const isHot = newStatus === 'INTERVIEW';
    const isCold = newStatus === 'REJECTED';

    if (notify && !isCold) {
      // Email (branded full reply, or teaser once paywall is on). Capture the send
      // outcome and ALWAYS log it (ok/error/threw) so we can tell "didn't deliver" from
      // "didn't open" — reply EMAIL_SENT was mysteriously 0 despite replies flowing.
      let res: { success: boolean; messageId?: string; error?: string } | null = null;
      let variant = 'branded';
      let threw: string | null = null;
      try {
        if (!lockReply) {
          const branded = replyNotificationEmail({
            userName: app.user.name || 'there',
            recruiterName: from.split('<')[0].trim() || app.companyName,
            company: app.companyName,
            jobTitle: app.jobTitle,
            replyPreview: replyText.slice(0, 200),
            replySignal: signal,
            category: newStatus,
            sentAgo: 'just now',
            appId,
            userId: app.userId,
          });
          res = await sendEmail({ to: app.user.email, subject: branded.subject, html: branded.html, text: branded.text, replyTo: `reply+${appId}@reply.freelanly.com` });
        } else {
          variant = 'teaser';
          const teaser = replyTeaserEmail({
            userName: app.user.name || 'there',
            recruiterName: from.split('<')[0].trim() || app.companyName,
            company: app.companyName,
            jobTitle: app.jobTitle,
            replySignal: signal,
            category: newStatus,
            appId,
            userId: app.userId,
          });
          res = await sendEmail({ to: app.user.email, subject: teaser.subject, html: teaser.html, text: teaser.text });
        }
      } catch (fwdErr) {
        threw = (fwdErr as Error)?.message || String(fwdErr);
        console.error(`[InboundReply] Forward threw:`, fwdErr);
      }
      await prisma.activityLog.create({
        data: { userId: app.userId, action: 'EMAIL_SENT', details: { applicationId: appId, kind: 'reply_notification', variant, hot: isHot, ok: !!res?.success, msgId: res?.messageId || null, err: threw || res?.error || null } },
      }).catch(() => {});
      console.log(`[InboundReply] Reply email to ${app.user.email} (${newStatus}) ok=${!!res?.success} err=${threw || res?.error || ''}`);

      // Telegram — HOT interview leads only. Higher open rate than email and pulls the
      // hot lead out of the inbox noise (where 63% of invites currently go unseen).
      if (isHot && app.user.telegramChatId) {
        try {
          const tg = formatReplyNotification({
            userName: app.user.name || 'there',
            companyName: app.companyName,
            jobTitle: app.jobTitle,
            replyPreview: replyText,
            category: newStatus,
          });
          await sendTelegramNotification(app.user.telegramChatId, tg.text, tg.markup);
          console.log(`[InboundReply] Telegram (hot lead) sent to ${app.user.email}`);
        } catch (tgErr) {
          console.error(`[InboundReply] Telegram failed:`, tgErr);
        }
      }

      // Slack
      if (app.user.notifySlackUrl) {
        try {
          await fetch(app.user.notifySlackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              blocks: [
                { type: 'section', text: { type: 'mrkdwn', text: `${isHot ? '🔥 *Interview request*' : '*New reply*'} from ${app.companyName} — ${app.jobTitle}` } },
                { type: 'section', text: { type: 'mrkdwn', text: signal ? `> ${signal}` : `> ${replyText.slice(0, 100)}...` } },
                { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Open in Freelanly' }, url: 'https://freelanly.com/dashboard?tab=inbox' }] },
              ],
            }),
          });
          console.log(`[InboundReply] Slack notified for ${app.user.email}`);
        } catch (slackErr) {
          console.error(`[InboundReply] Slack failed:`, slackErr);
        }
      }
    } else {
      console.log(`[InboundReply] ${appId} → ${newStatus} — notification suppressed (${isCold ? 'rejection, kept quiet' : 'user opted out'})`);
    }

    return NextResponse.json({ ok: true, appId, notified: notify && !isCold, hot: isHot });
  } catch (error) {
    console.error('[InboundReply] Error:', error);
    return NextResponse.json({ ok: true }); // Always 200 to prevent Postal retries
  }
}
