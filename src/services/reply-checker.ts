import * as tls from 'tls';
import { prisma } from '@/lib/db';
import { AutoApplyStatus } from '@prisma/client';
import OpenAI from 'openai';
import { sendEmail } from '@/lib/email';

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
    if (cat.includes('INTERESTED')) return 'REPLIED';
    return 'REPLIED';
  } catch { return 'REPLIED'; }
}

/**
 * Map SMTP host to corresponding IMAP host
 */
function smtpToImapHost(smtpHost: string): string {
  const mapping: Record<string, string> = {
    'smtp.gmail.com': 'imap.gmail.com',
    'smtp-mail.outlook.com': 'outlook.office365.com',
    'smtp.mail.yahoo.com': 'imap.mail.yahoo.com',
    'smtp.office365.com': 'outlook.office365.com',
    'smtp.live.com': 'outlook.office365.com',
  };
  return mapping[smtpHost] || smtpHost.replace('smtp.', 'imap.');
}

/**
 * Send an IMAP command and wait for tagged response
 */
function sendImapCommand(
  socket: tls.TLSSocket,
  tag: string,
  command: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    let response = '';
    const timeout = setTimeout(() => {
      reject(new Error(`IMAP timeout for command: ${tag} ${command}`));
    }, 8000);

    const onData = (data: Buffer) => {
      response += data.toString();
      // Check if we got the tagged response (completion)
      if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
        clearTimeout(timeout);
        socket.removeListener('data', onData);
        resolve(response);
      }
    };

    socket.on('data', onData);
    socket.write(`${tag} ${command}\r\n`);
  });
}

/**
 * Connect to IMAP and search for replies to given subjects
 */
/**
 * Extract plain text body from IMAP FETCH response
 */
function decodeBase64Block(text: string): string {
  try { return Buffer.from(text.replace(/\r?\n/g, ''), 'base64').toString('utf-8'); } catch { return ''; }
}

function stripHtml(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function cleanMimeText(text: string): string {
  let body = text;
  // Strip null bytes
  body = body.replace(/\0/g, '');
  // Decode quoted-printable
  body = body.replace(/=\r?\n/g, '');
  body = body.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  // Strip HTML
  if (body.includes('<html') || body.includes('<div') || body.includes('<p')) {
    body = stripHtml(body);
  }
  // Strip MIME boundaries and artifacts (aggressive)
  body = body.replace(/--[0-9a-fA-F]{20,}\s*/g, '');
  body = body.replace(/--[a-zA-Z0-9_=.-]{10,}--?\s*/g, '');
  body = body.replace(/------=[_a-zA-Z0-9.]+\s*/g, '');
  body = body.replace(/boundary="[^"]*"\s*/g, '');
  body = body.replace(/Content-Type:[^\n]*\n/gi, '');
  body = body.replace(/Content-Transfer-Encoding:[^\n]*\n/gi, '');
  body = body.replace(/Content-Disposition:[^\n]*\n/gi, '');
  body = body.replace(/charset="[^"]*"\s*/gi, '');
  body = body.replace(/This is a multi-part message in MIME format\.\s*/gi, '');
  body = body.replace(/\[cid:[^\]]*\]/g, '');
  body = body.replace(/\r?\n{3,}/g, '\n\n');
  return body.trim();
}

function extractBodyFromFetch(fetchResp: string): string {
  // Look for literal size marker {NNN} then grab the content
  const literalMatch = fetchResp.match(/\{(\d+)\}\r\n/);
  if (literalMatch) {
    const size = parseInt(literalMatch[1], 10);
    const start = fetchResp.indexOf(literalMatch[0]) + literalMatch[0].length;
    let body = fetchResp.slice(start, start + size);

    // Try to find and decode base64 blocks within MIME parts
    // Split by MIME boundaries and look for base64-encoded text/plain parts
    const parts = body.split(/--[a-zA-Z0-9_=-]+\r?\n/);
    for (const part of parts) {
      const isBase64 = /Content-Transfer-Encoding:\s*base64/i.test(part);
      const isTextPlain = /Content-Type:\s*text\/plain/i.test(part);
      if (isBase64 && isTextPlain) {
        // Extract base64 content after headers (double newline)
        const headerEnd = part.search(/\r?\n\r?\n/);
        if (headerEnd > 0) {
          const b64 = part.slice(headerEnd).trim();
          const decoded = decodeBase64Block(b64);
          if (decoded.length > 10) return cleanMimeText(decoded);
        }
      }
    }

    // Also try: entire body is base64 (simple case)
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(body.trim()) && body.length > 50) {
      const decoded = decodeBase64Block(body);
      if (decoded.length > 10) return cleanMimeText(decoded);
    }

    // Also try: body has base64 blocks without proper Content-Type headers
    // Look for large base64 chunks (lines of 76 chars)
    const b64Blocks = body.match(/(?:^|\n)([A-Za-z0-9+/=\r\n]{100,})(?:\n|$)/);
    if (b64Blocks) {
      const decoded = decodeBase64Block(b64Blocks[1]);
      if (decoded.length > 10 && /[a-zA-Z]{3,}/.test(decoded)) return cleanMimeText(decoded);
    }

    // Fallback: clean as-is
    return cleanMimeText(body);
  }

  // Fallback: try to extract any readable text between FETCH markers
  const bodyStart = fetchResp.indexOf('\r\n\r\n');
  if (bodyStart > 0) {
    let fallback = fetchResp.slice(bodyStart + 4);
    const closingTag = fallback.lastIndexOf(')');
    if (closingTag > 0) fallback = fallback.slice(0, closingTag);
    fallback = stripHtml(fallback).trim();
    if (fallback.length > 10) return fallback.slice(0, 2000);
  }
  return '';
}

async function searchForReplies(
  imapHost: string,
  email: string,
  password: string,
  subjects: { applicationId: string; subject: string; email: string }[]
): Promise<{ applicationId: string; replied: boolean; replyText?: string }[]> {
  const results: { applicationId: string; replied: boolean; replyText?: string }[] = [];

  if (subjects.length === 0) return results;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('IMAP connection timeout'));
    }, 120000);

    const socket = tls.connect(993, imapHost, { rejectUnauthorized: false });

    let tagCounter = 1;
    const nextTag = () => `A${String(tagCounter++).padStart(3, '0')}`;

    socket.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    socket.once('data', async (data) => {
      const greeting = data.toString();
      if (!greeting.includes('OK')) {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error(`IMAP greeting failed: ${greeting}`));
        return;
      }

      try {
        // LOGIN
        const loginTag = nextTag();
        const loginResp = await sendImapCommand(
          socket,
          loginTag,
          `LOGIN "${email}" "${password.replace(/"/g, '\\"')}"`
        );
        if (!loginResp.includes(`${loginTag} OK`)) {
          throw new Error(`IMAP LOGIN failed: ${loginResp.slice(0, 200)}`);
        }

        // SELECT INBOX
        const selectTag = nextTag();
        const selectResp = await sendImapCommand(socket, selectTag, 'SELECT INBOX');
        if (!selectResp.includes(`${selectTag} OK`)) {
          throw new Error(`IMAP SELECT failed: ${selectResp.slice(0, 200)}`);
        }

        // Group by email to minimize IMAP searches
        const emailToApps = new Map<string, { applicationId: string; subject: string }[]>();
        for (const s of subjects) {
          const existing = emailToApps.get(s.email) || [];
          existing.push(s);
          emailToApps.set(s.email, existing);
        }

        const sinceDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const imapDate = `${sinceDate.getDate()}-${sinceDate.toLocaleString('en-US', { month: 'short' })}-${sinceDate.getFullYear()}`;

        for (const [fromEmail, apps] of emailToApps) {
          try {
            const searchTag = nextTag();
            const searchResp = await sendImapCommand(
              socket,
              searchTag,
              `SEARCH FROM "${fromEmail}" SINCE ${imapDate}`
            );

            const searchLine = searchResp
              .split('\r\n')
              .find((l) => l.startsWith('* SEARCH'));
            const hasResults =
              searchLine !== undefined &&
              searchLine.trim() !== '* SEARCH' &&
              searchLine.replace('* SEARCH', '').trim().length > 0;

            if (hasResults && searchLine) {
              // Get the latest message UID
              const uids = searchLine.replace('* SEARCH', '').trim().split(/\s+/);
              const latestUid = uids[uids.length - 1];

              // FETCH body of the latest reply
              let replyText = '';
              try {
                const fetchTag = nextTag();
                const fetchResp = await sendImapCommand(
                  socket,
                  fetchTag,
                  `FETCH ${latestUid} BODY.PEEK[TEXT]`
                );
                if (fetchResp.includes(`${fetchTag} OK`)) {
                  replyText = extractBodyFromFetch(fetchResp);
                }
                // Fallback: if TEXT part is empty, try fetching full body
                if (!replyText || replyText.length < 5) {
                  const fetchTag2 = nextTag();
                  const fetchResp2 = await sendImapCommand(
                    socket,
                    fetchTag2,
                    `FETCH ${latestUid} BODY.PEEK[1]`
                  );
                  if (fetchResp2.includes(`${fetchTag2} OK`)) {
                    const fallback = extractBodyFromFetch(fetchResp2);
                    if (fallback.length > replyText.length) replyText = fallback;
                  }
                }
              } catch {
                // Fetch failed, still mark as replied but without body
              }

              for (const app of apps) {
                results.push({ applicationId: app.applicationId, replied: true, replyText: replyText.slice(0, 2000) });
              }
            } else {
              for (const app of apps) {
                results.push({ applicationId: app.applicationId, replied: false });
              }
            }
          } catch {
            for (const app of apps) {
              results.push({ applicationId: app.applicationId, replied: false });
            }
          }
        }

        // LOGOUT
        const logoutTag = nextTag();
        await sendImapCommand(socket, logoutTag, 'LOGOUT').catch(() => {});

        clearTimeout(timeout);
        socket.destroy();
        resolve(results);
      } catch (err) {
        clearTimeout(timeout);
        socket.destroy();
        reject(err);
      }
    });
  });
}

/**
 * Check replies for a specific user's sent auto-applications.
 * Returns number of newly detected replies.
 */
export async function checkRepliesForUser(userId: string): Promise<number> {
  // Get user's SMTP config + user info for notifications
  const [smtp, user] = await Promise.all([
    prisma.userSmtp.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, notifyOnReply: true } }),
  ]);

  if (!smtp || !smtp.verified) return 0;

  // Get recent SENT/DELIVERED/OPENED applications (last 14 days)
  const recentApps = await prisma.autoApplication.findMany({
    where: {
      userId,
      status: { in: [AutoApplyStatus.SENT, AutoApplyStatus.DELIVERED, AutoApplyStatus.OPENED] },
      sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, subject: true, appliedToEmail: true },
    orderBy: { sentAt: 'desc' },
  });

  if (recentApps.length === 0) return 0;

  const imapHost = smtpToImapHost(smtp.host);
  const subjects = recentApps.map((app) => ({
    applicationId: app.id,
    subject: app.subject || '',
    email: app.appliedToEmail,
  }));

  try {
    const results = await searchForReplies(imapHost, smtp.email, smtp.password, subjects);

    let repliedCount = 0;
    for (const result of results) {
      if (result.replied) {
        // Strip null bytes and non-printable chars that PostgreSQL rejects
        const replyText = (result.replyText || '').replace(/\0/g, '').replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '');
        const category = replyText.length > 10 ? await categorizeReply(replyText) : 'REPLIED';

        await prisma.autoApplication.update({
          where: { id: result.applicationId },
          data: {
            status: category as AutoApplyStatus,
            replyText: replyText || null,
            replyCategory: category,
            repliedAt: new Date(),
          },
        });
        repliedCount++;
        // Track engagement event
        await prisma.activityLog.create({
          data: { userId, action: 'RECRUITER_REPLIED', details: { applicationId: result.applicationId, category } },
        }).catch(() => {});
        console.log(`[ReplyChecker] ${result.applicationId} → ${category}: ${replyText.slice(0, 80)}`);
      }
    }

    // Send email notification for new replies
    if (repliedCount > 0 && user?.email && user.notifyOnReply !== false) {
      const apps = await prisma.autoApplication.findMany({
        where: { userId, repliedAt: { gte: new Date(Date.now() - 60000) } },
        select: { id: true, companyName: true, jobTitle: true, replyCategory: true, replyText: true },
        take: 5,
      });
      const firstName = user.name?.split(' ')[0] || 'there';
      const trackBase = `https://freelanly.com/api/track`;
      const dashUrl = `${trackBase}/click?uid=${userId}&type=reply_notification&url=${encodeURIComponent('https://freelanly.com/dashboard')}`;
      const openPixel = `<img src="${trackBase}/open?uid=${userId}&aid=reply_notify_${Date.now()}" width="1" height="1" style="display:none" alt="" />`;

      const replyList = apps.map(a => {
        const preview = a.replyText ? a.replyText.replace(/<[^>]+>/g, '').slice(0, 100) : '';
        const emoji = a.replyCategory === 'INTERVIEW' ? '🟢' : a.replyCategory === 'REJECTED' ? '🔴' : '💬';
        return `<tr><td style="padding:12px 16px;border-bottom:1px solid #E8E5DC"><strong>${emoji} ${a.companyName}</strong><br><span style="color:#666;font-size:13px">${a.jobTitle}</span><br><span style="color:#888;font-size:13px">${preview}${preview.length >= 100 ? '...' : ''}</span></td></tr>`;
      }).join('');

      await sendEmail({
        to: user.email,
        subject: repliedCount === 1
          ? `${apps[0]?.companyName || 'A recruiter'} replied to your application!`
          : `${repliedCount} new replies to your applications!`,
        html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px">
          <h2 style="margin:0 0 8px">Hey ${firstName}, you got ${repliedCount === 1 ? 'a reply' : `${repliedCount} replies`}! 🎉</h2>
          <p style="color:#555;margin:0 0 20px;line-height:1.6">Recruiters responded to your applications. View and reply to keep the conversation going.</p>
          <table style="width:100%;border:1px solid #E8E5DC;border-radius:10px;border-collapse:collapse">${replyList}</table>
          <div style="margin-top:24px;text-align:center">
            <a href="${dashUrl}" style="display:inline-block;padding:14px 32px;background:#C7F94A;color:#000;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">View & Reply →</a>
          </div>
          <p style="margin-top:24px;font-size:12px;color:#999;text-align:center">You're receiving this because you have auto-apply running on Freelanly.</p>
          ${openPixel}
        </div>`,
        text: `Hey ${firstName}, you got ${repliedCount} new ${repliedCount === 1 ? 'reply' : 'replies'}! View and reply: https://freelanly.com/dashboard`,
      }).catch(e => console.error(`[ReplyChecker] Failed to send notification to ${user.email}:`, e));
    }

    return repliedCount;
  } catch (error) {
    console.error(`[ReplyChecker] Error checking replies for user ${userId}:`, error);
    return 0;
  }
}

/**
 * Check replies for ALL users with active auto-apply loops.
 * Called by cron periodically.
 */
export async function checkAllReplies(): Promise<number> {
  // Find users with recent sent applications
  const usersWithSentApps = await prisma.autoApplication.findMany({
    where: {
      status: { in: [AutoApplyStatus.SENT, AutoApplyStatus.DELIVERED, AutoApplyStatus.OPENED] },
      sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  let totalReplies = 0;

  // Check ALL users in parallel batches (20 concurrent IMAP connections)
  const BATCH_SIZE = 20;
  console.log(`[ReplyChecker] Checking ${usersWithSentApps.length} users in batches of ${BATCH_SIZE}`);

  for (let i = 0; i < usersWithSentApps.length; i += BATCH_SIZE) {
    const batch = usersWithSentApps.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async ({ userId }) => {
        try {
          const replies = await checkRepliesForUser(userId);
          if (replies > 0) {
            console.log(`[ReplyChecker] Found ${replies} replies for user ${userId}`);
          }
          return replies;
        } catch (error) {
          console.error(`[ReplyChecker] Failed for user ${userId}:`, String(error).slice(0, 200));
          return 0;
        }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') totalReplies += r.value;
    }
  }

  return totalReplies;
}
