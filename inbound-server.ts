import http from 'http';
import { prisma } from './src/lib/db';
import { sendEmail } from './src/lib/email';
import { isScamReply } from './src/lib/scam-filter';
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
        { role: 'system', content: 'Categorize this recruiter reply. Return ONE word:\n- INTERVIEW = recruiter CONCRETELY moves to a call/interview: proposes a specific time, asks for your availability, or says to book/schedule a call or interview. NOT for "thank you for applying", a vague "we will be in touch" / "let us discuss", or just "share your CV".\n- INTERESTED = asks for resume/CV/portfolio/details, or positive interest WITHOUT concretely proposing a call.\n- REJECTION = explicit rejection.\n- SPAM = unpaid internship, no compensation, volunteer, TMDA/captcha verification, out of office, delivery bounce, OR asking you to PAY for a resume rewrite/review/service.\n- OTHER = unrelated or unclear.\nWhen unsure between INTERVIEW and INTERESTED, choose INTERESTED.' },
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

async function sendTelegramNotify(chatId: string, companyName: string, jobTitle: string, category: string, appliedDaysAgo: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  const emoji = category === 'INTERVIEW' ? '🟢' : category === 'REJECTED' ? '🔴' : '💬';
  const label = category === 'INTERVIEW' ? 'Interested — wants to schedule interview' : category === 'REJECTED' ? 'Not a fit' : 'Interested — asking for more info';
  const status = category === 'INTERVIEW' ? 'Recruiter wants to interview' : category === 'REJECTED' ? 'Position closed' : 'Recruiter wants to proceed';
  const appliedText = appliedDaysAgo === 0 ? 'today' : appliedDaysAgo === 1 ? 'yesterday' : `${appliedDaysAgo} days ago`;
  const hot = category === 'INTERVIEW';
  const text = `${hot ? '🔥 <b>Interview request!</b>' : '💬 <b>New reply to your application!</b>'}\n\n🏢 <b>${companyName}</b>\n💼 ${jobTitle}\n${emoji} ${label}\n\n⏰ Applied: ${appliedText}\n📊 Status: ${status}`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: { inline_keyboard: [[{ text: '💬 View & Reply', url: 'https://freelanly.com/dashboard/inbox' }]] } }),
    });
    console.log(`[Inbound] Telegram sent to ${chatId}`);
  } catch (e) { console.error('[Inbound] Telegram failed:', e); }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/inbound') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const rcptTo = data.rcpt_to || data.to || '';
        const from = data.mail_from || data.from || '';
        const plainBody = data.plain_body || data.text || '';
        const htmlBody = data.html_body || data.html || '';

        const match = rcptTo.match(/reply\+([a-z0-9]+)@/i);
        if (!match) {
          console.log(`[Inbound] No appId in: ${rcptTo}`);
          res.writeHead(200); res.end('ok'); return;
        }

        const appId = match[1];
        const app = await prisma.autoApplication.findUnique({
          where: { id: appId },
          select: { id: true, status: true, userId: true, jobTitle: true, companyName: true, sentAt: true,
            user: { select: { email: true, name: true, notifyOnReply: true, telegramChatId: true } } },
        });

        if (!app) {
          console.log(`[Inbound] App not found: ${appId}`);
          res.writeHead(200); res.end('ok'); return;
        }

        const replyText = (plainBody || htmlBody?.replace(/<[^>]*>/g, '') || '').trim();

        // Predatory resume-rewrite "recruiters": treat like SPAM — no notify, no count.
        if (isScamReply(from, replyText)) {
          console.log(`[Inbound] Scam reply filtered: ${appId} from ${from}`);
          res.writeHead(200); res.end(JSON.stringify({ ok: true, scam: true })); return;
        }

        const category = replyText.length > 10 ? await categorizeReply(replyText) : 'REPLIED';
        if (category === "SPAM") { console.log("[Inbound] SPAM filtered:", appId, replyText.slice(0, 80)); res.writeHead(200); res.end(JSON.stringify({ ok: true, spam: true })); return; }

        if (app.status !== 'INTERVIEW' && app.status !== 'OFFER') {
          await prisma.autoApplication.update({
            where: { id: appId },
            data: { status: category as any, replyText: replyText.slice(0, 2000).replace(/\0/g, ''), replyCategory: category, repliedAt: new Date() },
          });
          await prisma.message.create({ data: { applicationId: appId, from: 'recruiter', text: replyText.slice(0, 2000) } }).catch(() => {});
        console.log(`[Inbound] ${appId} → ${category}: ${replyText.slice(0, 80)}`);
        }

        // Track event
        await prisma.activityLog.create({
          data: { userId: app.userId, action: 'RECRUITER_REPLIED', details: { applicationId: appId, category, source: 'postal_inbound_hetzner' } },
        }).catch(() => {});

        // Tiered notifications: notify on INTERVIEW + REPLIED (actionable), stay SILENT on
        // REJECTED (cold) — kills notification fatigue so real interviews are not buried.
        const isCold = category === 'REJECTED';
        if (app.user.notifyOnReply !== false && !isCold) {
          const firstName = app.user.name?.split(' ')[0] || 'there';
          const preview = replyText.replace(/<[^>]+>/g, '').replace(/â/g, "'").slice(0, 100);
          const emoji = category === 'INTERVIEW' ? '🟢' : '💬';
          const hot = category === 'INTERVIEW';

          // Email notification — capture the send outcome (ok/err) so we can tell
          // "didn't deliver" from "didn't open".
          let sendOk = false; let sendErr: string | null = null;
          try {
            const r = await sendEmail({
              to: app.user.email,
              subject: hot ? `🔔 ${app.companyName} wants to interview you!` : `${app.companyName} replied to your application!`,
              html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
                <h2 style="margin:0 0 8px">${hot ? `An interview request, ${firstName}! 🔔` : `Hey ${firstName}, you got a reply! 🎉`}</h2>
                <p style="color:#555;margin:0 0 20px;line-height:1.6">A recruiter responded to your application.</p>
                <table style="width:100%;border:1px solid #E8E5DC;border-radius:10px;border-collapse:collapse">
                  <tr><td style="padding:12px 16px"><strong>${emoji} ${app.companyName}</strong><br>
                  <span style="color:#666;font-size:13px">${app.jobTitle}</span><br>
                  <span style="color:#888;font-size:13px">${preview}</span></td></tr>
                </table>
                <div style="margin-top:24px;text-align:center">
                  <a href="https://freelanly.com/api/track/reply-click?app=${appId}&u=${app.userId}&to=${encodeURIComponent('/dashboard?tab=inbox')}" style="display:inline-block;padding:14px 32px;background:#C7F94A;color:#000;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">View & Reply →</a>
                </div>
                <img src="https://freelanly.com/api/track/reply-open?app=${appId}&u=${app.userId}" width="1" height="1" style="display:none" alt="" />
              </div>`,
              text: `Hey ${firstName}, ${app.companyName} replied! View: https://freelanly.com/dashboard/inbox`,
            });
            sendOk = !!(r && r.success); sendErr = (r && r.error) || null;
          } catch (e) {
            sendErr = (e as Error)?.message || String(e);
          }
          await prisma.activityLog.create({
            data: { userId: app.userId, action: 'EMAIL_SENT', details: { applicationId: appId, kind: 'reply_notification', hot, ok: sendOk, err: sendErr } },
          }).catch(() => {});
          console.log(`[Inbound] reply email to ${app.user.email} ok=${sendOk} err=${sendErr || ''}`);

          // Telegram notification
          if (app.user.telegramChatId) {
            const daysAgo = Math.floor((Date.now() - (app.sentAt?.getTime() || Date.now())) / 86400000);
            sendTelegramNotify(app.user.telegramChatId, app.companyName, app.jobTitle, category, daysAgo);
          }
        } else if (isCold) {
          console.log(`[Inbound] ${appId} rejected — notification suppressed (silent tier)`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        console.error('[Inbound] Error:', e);
        res.writeHead(500); res.end('error');
      }
    });
  } else {
    res.writeHead(200); res.end('ok');
  }
});

const PORT = 8025;
server.listen(PORT, () => console.log(`[Inbound] Listening on port ${PORT}`));
