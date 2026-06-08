import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import OpenAI from 'openai';
import { sendAutoApplyViaPostal } from '@/lib/email/postal';
import { sendEmailViaSMTP } from '@/lib/smtp-sender';
import { fetchResumeAttachment } from '@/lib/resume-attachment';

function getAIClient() {
  const p = process.env.AI_PROVIDER?.toLowerCase();
  if (p === 'zai') return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
  return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
}

/**
 * Strip AI "here's what you could send" meta-framing that the suggest model sometimes
 * emits and that has leaked VERBATIM to recruiters (real case: "You can reply like this
 * after receiving the 'Please share updated resume' email: Hi …"). Matches whether it
 * leads the message OR sits after a greeting (NOT anchored to ^), and runs at BOTH suggest
 * and send time. High-signal instruction phrases only (reply/respond/say + here's-a-draft
 * + leading labels), each requiring a trailing colon, so genuine applicant prose is left
 * intact ("you can reach me", "here's my availability:" etc. are not touched).
 */
function stripMetaFraming(input: string): string {
  if (!input) return input;
  let s = input;
  // Each requires a trailing colon and a high-signal instruction phrase. "Sure" is only an
  // optional lead-in to the framing (never stripped on its own — "Sure, my availability:"
  // is legit prose, must survive).
  const patterns: RegExp[] = [
    /(sure[,!.]?\s+)?here(?:'|’|`)?s?\s+(is\s+)?(a\s+)?(draft|suggested?|possible)?\s*(reply|response|message)\b[^:\n]{0,80}:\s*/i,
    /(sure[,!.]?\s+)?\byou (can|could|might|may|should)\s+(reply|respond|say|answer)\b[^:\n]{0,140}:\s*/i,
    /(sure[,!.]?\s+)?\b(feel free to|simply)\s+(reply|respond|say|answer|copy|paste)\b[^:\n]{0,140}:\s*/i,
    /^\s*(draft|suggested reply|suggestion|example reply|response)\s*:\s*/i,
  ];
  for (const re of patterns) s = s.replace(re, '');
  s = s.replace(/^\s*["'“”]+|["'“”]+\s*$/g, '').trim();
  return s;
}

/**
 * Drop any sentence where the model wrongly claims the applicant / the platform CANNOT
 * attach or share files. This line was killing interviews ("the platform does not currently
 * support attaching files directly" sent when the recruiter had asked for a mandatory CV).
 * We DO support attachments — never tell a recruiter otherwise.
 */
function dropAttachExcuses(input: string): string {
  if (!input) return input;
  const bad = /(can(?:not|'t|’t)|unable|won'?t|do(?:es)?(?:n'?t| not)).{0,40}(attach|upload|share|send|provide).{0,30}(file|document|cv|résumé|resume|attachment)|(platform|system|site|portal|here)\b.{0,35}(does(?:n'?t| not)|not|no longer|cannot|can'?t).{0,30}(support|allow|let|enable|permit).{0,25}(attach|upload|file|document|sharing)/i;
  const kept = input.split(/(?<=[.!?])\s+/).filter((p) => !bad.test(p));
  const out = kept.join(' ').replace(/\s{2,}/g, ' ').trim();
  return out.length >= 3 ? out : input;
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
    const paywallEnabled = false; // Set to true when ready to enable paywall
    const isPro = paywallEnabled ? user?.plan !== 'FREE' : true;
    // Sentiment preview for FREE: show category + first 30 chars, not full text
    const isSentimentOnly = paywallEnabled && !isPro;

    const filter = request.nextUrl.searchParams.get('filter') || 'all';

    const where: Record<string, unknown> = {
      userId: session.user.id,
      // Inbox only shows real recruiter replies. REJECTED counts ONLY when it came from
      // a reply — the matcher writes phantom REJECTED rows (never sent) that must not show.
      OR: [
        { status: { in: ['REPLIED', 'INTERVIEW', 'OFFER'] } },
        { status: 'REJECTED', repliedAt: { not: null } },
      ],
    };

    if (filter === 'interested') { delete where.OR; where.status = 'REPLIED'; }
    if (filter === 'interview') { delete where.OR; where.status = 'INTERVIEW'; }
    if (filter === 'rejected') { delete where.OR; where.status = 'REJECTED'; where.repliedAt = { not: null }; }

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
        replySignal: true,
        repliedAt: true,
        updatedAt: true,
      },
    });

    const enriched = threads.map(t => {
      // FREE with paywall: sentiment preview (category + 30 chars)
      // PRO or paywall off: full text
      const replyText = isPro ? t.replyText : (t.replyText ? t.replyText.slice(0, 30) + '...' : null);
      const locked = isSentimentOnly && !!t.replyText;
      const sentiment = t.replyCategory === 'INTERVIEW' ? 'Wants to schedule a call 🟢'
        : t.replyCategory === 'REPLIED' ? 'Interested 🟢'
        : t.replyCategory === 'REJECTED' ? 'Not a fit 🔴'
        : t.replyCategory === 'INFO_REQUEST' ? 'Asking for more info 🟡'
        : 'Replied 🟢';

      return {
        ...t,
        replyText,
        locked,
        sentiment: locked ? sentiment : undefined,
        thread: [
          { from: 'you', text: t.coverLetter, date: t.sentAt },
          ...(t.followUpSentAt ? [{ from: 'you', text: '(Follow-up sent)', date: t.followUpSentAt }] : []),
          ...(t.replyText ? [{ from: 'recruiter', text: isPro ? t.replyText : `${sentiment} — Upgrade to Pro to read full reply`, date: t.repliedAt || t.updatedAt }] : []),
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

    const { applicationId, action, message, attachmentBase64, attachmentFilename, attachResume } = await request.json();

    const app = await prisma.autoApplication.findFirst({
      where: { id: applicationId, userId: session.user.id },
      include: {
        user: { select: { name: true, email: true, userSmtp: true, resumeUrl: true, resumeFileName: true } },
      },
    });

    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // AI Suggested Reply
    if (action === 'suggest') {
      const replyText = app.replyText || '';
      const { client, model } = getAIClient();

      const hasResume = !!app.user.resumeUrl && app.user.resumeUrl.includes('blob.vercel-storage');
      const response = await client.chat.completions.create({
        model,
        temperature: 0.6,
        max_tokens: 200,
        messages: [
          { role: 'system', content: 'You are drafting the reply a job applicant will send to a recruiter. Output ONLY the message body the applicant sends — first person (I/my/me), 2-3 sentences, ready to paste as-is. Do NOT add any preamble, framing, or instructions: never write "You can reply like this", "Here is a draft", "You could say", and do not restate or quote the recruiter message. Do NOT add a greeting or signature (those are added separately). NEVER use third person or the applicant name. If the recruiter asks for a CV, résumé, portfolio, or documents, reply positively that you are sharing/attaching it (e.g. "I have attached my résumé." or "I would be glad to share my résumé."). NEVER claim you cannot attach files or that the platform does not support attachments — the applicant CAN attach their résumé. Return just the reply text, nothing else.' },
          { role: 'user', content: `Recruiter message: "${replyText.slice(0, 300)}"\nOriginal application was for: ${app.jobTitle} at ${app.companyName}\nI am: ${app.user.name}${hasResume ? '\nI have a résumé I can attach to this reply.' : ''}` },
        ],
      });

      // Defensive: strip meta-framing the model sometimes prepends/embeds (it once shipped
      // "You can reply like this after receiving … : Hi …" verbatim to a recruiter).
      let suggested = dropAttachExcuses(stripMetaFraming((response.choices[0]?.message?.content || '').trim()));
      if (!suggested || suggested.length < 3) suggested = 'Thank you for your response. I would be happy to discuss further.';

      await prisma.activityLog.create({
        data: { userId: session.user.id, action: 'INBOX_AI_SUGGEST', details: { applicationId, company: app.companyName } },
      }).catch(() => {});

      return NextResponse.json({
        suggested,
        full: `Dear ${app.companyName.split(' ')[0]},\n\n${suggested}\n\nBest regards,\n${app.user.name}`,
      });
    }

    // Send Reply
    if (action === 'send' && message) {
      // Belt-and-suspenders: strip AI meta-framing at SEND time too (the suggest-time strip
      // only protects fresh suggestions — users edit, paste, or the preamble sits after the
      // greeting; this is what actually reaches the recruiter, so sanitize it here).
      const outgoing = stripMetaFraming(message).slice(0, 2000) || message.slice(0, 2000);

      // Dedup: check if same message was sent in last 60 seconds
      const recentDupe = await prisma.message.findFirst({
        where: { applicationId, from: 'user', text: outgoing, createdAt: { gte: new Date(Date.now() - 60000) } },
      });
      if (recentDupe) {
        return NextResponse.json({ success: true, sentTo: app.appliedToEmail, note: 'already_sent' });
      }

      // Resolve attachment: an explicit base64 from the client, or — for the common
      // "send me your CV" reply — the user's stored résumé, fetched & encoded server-side
      // (no CORS / huge request body). Recruiters ask for the CV constantly; this makes
      // it one click instead of users pasting file paths or giving up to email.
      let attBase64: string | undefined = attachmentBase64;
      let attFilename: string | undefined = attachmentFilename;
      if (!attBase64 && attachResume) {
        const att = await fetchResumeAttachment(app.user.resumeUrl, app.user.resumeFileName);
        if (att) { attBase64 = att.base64; attFilename = att.filename; }
      }

      const subject = `Re: ${app.subject}`;
      const html = `<div style="font-family: sans-serif; font-size: 15px; line-height: 1.6; color: #333;">
        ${outgoing.split('\n').map((p: string) => `<p style="margin: 0 0 12px;">${p}</p>`).join('')}
      </div>`;

      let result;
      const hasSmtp = !!app.user.userSmtp?.verified;

      if (hasSmtp) {
        const smtp = app.user.userSmtp!;
        result = await sendEmailViaSMTP(
          { host: smtp.host, port: smtp.port, email: smtp.email, password: smtp.password },
          { from: `${app.user.name} <${smtp.email}>`, to: app.appliedToEmail, replyTo: smtp.email, subject, html, text: outgoing, attachmentBase64: attBase64, attachmentFilename: attFilename }
        );
      } else {
        result = await sendAutoApplyViaPostal({
          userName: app.user.name || 'Applicant',
          userEmail: app.user.email,
          to: app.appliedToEmail,
          subject,
          html,
          text: outgoing,
          applicationId: app.id,
          attachmentBase64: attBase64,
          attachmentFilename: attFilename,
        });
      }

      if (result.success) {
        await Promise.all([
          prisma.activityLog.create({
            data: { userId: session.user.id, action: 'INBOX_REPLY_SENT', details: { applicationId, to: app.appliedToEmail, company: app.companyName, viaSMTP: hasSmtp, message: outgoing.slice(0, 500), hasAttachment: !!attBase64 } },
          }),
          prisma.message.create({
            data: { applicationId, from: 'user', text: outgoing, attachmentUrl: attFilename || null },
          }),
        ]).catch(() => {});
        return NextResponse.json({ success: true, sentTo: app.appliedToEmail });
      } else {
        return NextResponse.json({ error: 'send_failed', message: result.error }, { status: 500 });
      }
    }

    // Snooze — hide from inbox for N days
    if (action === 'snooze') {
      const snoozeDays = message ? parseInt(message) : 7;
      const snoozeUntil = new Date(Date.now() + snoozeDays * 86400000);
      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: { errorMessage: `[snoozed] until ${snoozeUntil.toISOString().slice(0, 10)}` },
      });
      return NextResponse.json({ ok: true, snoozedUntil: snoozeUntil });
    }

    // Move to pipeline stage
    if (action === 'move') {
      const validStatuses = ['SENT', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'];
      const newStatus = message;
      if (!newStatus || !validStatuses.includes(newStatus)) {
        return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
      }
      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: { status: newStatus as any },
      });
      return NextResponse.json({ ok: true, status: newStatus });
    }

    // Book call — return user's booking URL
    if (action === 'book') {
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { bookingUrl: true },
      });
      return NextResponse.json({ bookingUrl: user?.bookingUrl || null });
    }

    // Rate recruiter reply
    if (action === 'rate' && message) {
      await prisma.activityLog.create({
        data: { userId: session.user.id, action: 'REPLY_RATED', details: { applicationId, company: app.companyName, rating: message } },
      }).catch(() => {});
      return NextResponse.json({ ok: true, rating: message });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Inbox] POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
