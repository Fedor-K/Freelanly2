import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { sendTelegramNotification } from '@/lib/telegram-notify';

/**
 * Hot-lead reminders.
 *
 * Analysis: 63% of interview invites go unanswered — many never even opened. This nudges
 * the user once if an INTERVIEW reply has sat unanswered for 6–72h. Email + Telegram
 * (if connected). Marked via AutoApplication.hotLeadReminderAt so we never repeat.
 *
 * GET or POST, Bearer CRON_SECRET (Vercel cron sends GET; manual triggers POST).
 */
async function run(): Promise<NextResponse> {
  const now = Date.now();
  const minAge = new Date(now - 6 * 60 * 60 * 1000);   // replied ≥ 6h ago
  const maxAge = new Date(now - 72 * 60 * 60 * 1000);  // but ≤ 72h ago (still relevant)

  const apps = await prisma.autoApplication.findMany({
    where: {
      status: 'INTERVIEW',
      hotLeadReminderAt: null,
      repliedAt: { lte: minAge, gte: maxAge },
    },
    select: {
      id: true, userId: true, companyName: true, jobTitle: true,
      replyText: true, replySignal: true, repliedAt: true,
      user: { select: { email: true, name: true, telegramChatId: true, notifyOnReply: true } },
    },
    take: 100,
  });

  if (apps.length === 0) return NextResponse.json({ ok: true, candidates: 0, reminded: 0 });

  // Which of these already got a user reply (on-platform) after the recruiter's message?
  const ids = apps.map((a) => a.id);
  const userMsgs = await prisma.message.findMany({
    where: { applicationId: { in: ids }, from: 'user' },
    select: { applicationId: true, createdAt: true },
  });
  const lastUserMsg = new Map<string, Date>();
  for (const m of userMsgs) {
    const cur = lastUserMsg.get(m.applicationId);
    if (!cur || m.createdAt > cur) lastUserMsg.set(m.applicationId, m.createdAt);
  }

  let reminded = 0;
  for (const app of apps) {
    const answered = (() => {
      const last = lastUserMsg.get(app.id);
      return last && app.repliedAt && last > app.repliedAt;
    })();
    const optedOut = app.user.notifyOnReply === false;

    // Mark processed regardless, so we never re-evaluate this app.
    await prisma.autoApplication.update({ where: { id: app.id }, data: { hotLeadReminderAt: new Date() } }).catch(() => {});

    if (answered || optedOut || !app.user.email) continue;

    const firstName = app.user.name?.split(' ')[0] || 'there';
    const preview = (app.replySignal || app.replyText || '').slice(0, 160);
    const inboxUrl = `https://freelanly.com/api/track/reply-click?app=${encodeURIComponent(app.id)}&u=${encodeURIComponent(app.userId)}&to=${encodeURIComponent('/dashboard?tab=inbox')}`;
    const subject = `⏰ ${app.companyName} wants to interview you — you haven't replied yet`;
    const html = `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#1a1a1a">
      <h2 style="margin:0 0 8px;font-size:19px">Don't let this one go cold, ${firstName} 👀</h2>
      <p style="color:#555;line-height:1.6;margin:0 0 16px"><strong>${app.companyName}</strong> replied about the <strong>${app.jobTitle}</strong> role and is waiting to hear back — your fastest path to an interview is a quick reply now.</p>
      ${preview ? `<div style="background:#F1F8E9;border-left:3px solid #7CB342;border-radius:8px;padding:12px 14px;color:#33691E;font-size:13px;margin:0 0 18px">"${preview}${preview.length >= 160 ? '…' : ''}"</div>` : ''}
      <a href="${inboxUrl}" style="display:inline-block;padding:12px 26px;background:#C7F94A;color:#000;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">Reply now →</a>
      <p style="color:#999;font-size:12px;margin-top:20px">Replies are easy to miss — connect Telegram in your dashboard to get pinged instantly next time.</p>
    </div>`;
    const text = `${app.companyName} replied about the ${app.jobTitle} role and is waiting to hear back. Reply now: https://freelanly.com/dashboard?tab=inbox`;

    try {
      await sendEmail({ to: app.user.email, subject, html, text, replyTo: `reply+${app.id}@reply.freelanly.com` });
      await prisma.activityLog.create({
        data: { userId: app.userId, action: 'EMAIL_SENT', details: { applicationId: app.id, kind: 'hot_lead_reminder' } },
      }).catch(() => {});
      reminded++;
    } catch (e) {
      console.error(`[HotLeadReminder] email failed for ${app.id}:`, e);
    }

    if (app.user.telegramChatId) {
      await sendTelegramNotification(
        app.user.telegramChatId,
        `⏰ <b>${app.companyName}</b> is waiting on you\n\n<b>${app.jobTitle}</b> — they want to interview you and you haven't replied yet.\n\n<a href="https://freelanly.com/dashboard/inbox">Reply now →</a>`,
        { inline_keyboard: [[{ text: '💬 Reply now', url: 'https://freelanly.com/dashboard/inbox' }]] }
      ).catch(() => {});
    }
  }

  console.log(`[HotLeadReminder] candidates=${apps.length} reminded=${reminded}`);
  return NextResponse.json({ ok: true, candidates: apps.length, reminded });
}

function authorized(request: NextRequest): boolean {
  return request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return run();
}
