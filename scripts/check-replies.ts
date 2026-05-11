/**
 * Standalone reply checker — runs on VPS via cron.
 * Connects to Neon DB, finds users with SMTP, checks IMAP for replies.
 * Usage: npx tsx scripts/check-replies.ts
 */

import * as tls from 'tls';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { config } from 'dotenv';
config({ path: '.env.local' });
config({ path: '.env' });

const prisma = new PrismaClient();

const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek';
function getAIClient() {
  if (AI_PROVIDER === 'zai') {
    return { client: new OpenAI({ baseURL: 'https://api.z.ai/api/paas/v4', apiKey: process.env.ZAI_API_KEY || '' }), model: 'glm-4-32b-0414-128k' };
  }
  return { client: new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: process.env.DEEPSEEK_API_KEY || '' }), model: 'deepseek-chat' };
}

async function categorizeReply(replyText: string): Promise<{ category: string; status: string }> {
  try {
    const { client, model } = getAIClient();
    const response = await client.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 50,
      messages: [
        { role: 'system', content: 'Categorize this recruiter reply to a job application. Return ONLY one word:\n- INTERESTED = recruiter asks for resume, CV, portfolio, details, or shows any positive interest\n- INTERVIEW = recruiter wants to schedule a call, meeting, or interview\n- REJECTION = explicit rejection ("unfortunately", "not a fit", "position filled")\n- OTHER = automated reply, out of office, or unrelated' },
        { role: 'user', content: replyText.slice(0, 500) },
      ],
    });
    const cat = response.choices[0]?.message?.content?.trim().toUpperCase() || 'OTHER';
    if (cat.includes('INTERVIEW')) return { category: 'interview', status: 'INTERVIEW' };
    if (cat.includes('INTERESTED') || cat.includes('INFO')) return { category: 'interested', status: 'REPLIED' };
    if (cat.includes('REJECTION') || cat.includes('REJECT')) return { category: 'rejected', status: 'REJECTED' };
    return { category: 'other', status: 'REPLIED' };
  } catch {
    return { category: 'unknown', status: 'REPLIED' };
  }
}

function smtpToImapHost(smtpHost: string): string {
  const mapping: Record<string, string> = {
    'smtp.gmail.com': 'imap.gmail.com',
    'smtp-mail.outlook.com': 'outlook.office365.com',
    'smtp.mail.yahoo.com': 'imap.mail.yahoo.com',
    'smtp.office365.com': 'outlook.office365.com',
  };
  return mapping[smtpHost] || smtpHost.replace('smtp.', 'imap.');
}

function sendImapCommand(socket: tls.TLSSocket, tag: string, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let response = '';
    const timeout = setTimeout(() => reject(new Error(`IMAP timeout: ${tag}`)), 15000);

    const onData = (data: Buffer) => {
      response += data.toString();
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

async function checkRepliesForUser(userId: string, email: string, password: string, smtpHost: string): Promise<number> {
  const imapHost = smtpToImapHost(smtpHost);

  const recentApps = await prisma.autoApplication.findMany({
    where: {
      userId,
      status: { in: ['SENT', 'DELIVERED', 'OPENED'] },
      sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, appliedToEmail: true },
    take: 50,
  });

  if (recentApps.length === 0) return 0;

  // Group by email to minimize searches
  const emailToApps = new Map<string, string[]>();
  for (const app of recentApps) {
    const existing = emailToApps.get(app.appliedToEmail) || [];
    existing.push(app.id);
    emailToApps.set(app.appliedToEmail, existing);
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      try { socket.destroy(); } catch {}
      resolve(0);
    }, 20000);

    const socket = tls.connect(993, imapHost, { rejectUnauthorized: false });
    let tagCounter = 1;
    const nextTag = () => `A${String(tagCounter++).padStart(3, '0')}`;

    socket.once('error', () => {
      clearTimeout(timeout);
      resolve(0);
    });

    socket.once('data', async (data) => {
      const greeting = data.toString();
      if (!greeting.includes('OK')) {
        clearTimeout(timeout);
        socket.destroy();
        resolve(0);
        return;
      }

      try {
        const loginTag = nextTag();
        const loginResp = await sendImapCommand(socket, loginTag, `LOGIN "${email}" "${password.replace(/"/g, '\\"')}"`);
        if (!loginResp.includes(`${loginTag} OK`)) throw new Error('LOGIN failed');

        const selectTag = nextTag();
        const selectResp = await sendImapCommand(socket, selectTag, 'SELECT INBOX');
        if (!selectResp.includes(`${selectTag} OK`)) throw new Error('SELECT failed');

        const sinceDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        const imapDate = `${sinceDate.getDate()}-${sinceDate.toLocaleString('en-US', { month: 'short' })}-${sinceDate.getFullYear()}`;

        let repliedCount = 0;

        for (const [fromEmail, appIds] of emailToApps) {
          try {
            const searchTag = nextTag();
            const searchResp = await sendImapCommand(socket, searchTag, `SEARCH FROM "${fromEmail}" SINCE ${imapDate}`);

            const searchLine = searchResp.split('\r\n').find(l => l.startsWith('* SEARCH'));
            const hasResults = searchLine !== undefined &&
              searchLine.trim() !== '* SEARCH' &&
              searchLine.replace('* SEARCH', '').trim().length > 0;

            if (hasResults) {
              // Get first message ID from search results
              const msgIds = searchLine!.replace('* SEARCH', '').trim().split(/\s+/);
              const lastMsgId = msgIds[msgIds.length - 1];

              // Fetch email body text
              let replyText = '';
              if (lastMsgId) {
                try {
                  const fetchTag = nextTag();
                  const fetchResp = await sendImapCommand(socket, fetchTag, `FETCH ${lastMsgId} (BODY.PEEK[1.1])`);
                  // Extract plain text body
                  const bodyMatch = fetchResp.match(/\{(\d+)\}\r\n([\s\S]*?)(?:\r\n\)|\r\nA\d{3})/);
                  let rawBody = bodyMatch ? bodyMatch[2] : fetchResp;
                  // Try base64 decode
                  const cleaned = rawBody.replace(/\s/g, '');
                  if (/^[A-Za-z0-9+/=]+$/.test(cleaned) && cleaned.length > 20) {
                    try { rawBody = Buffer.from(cleaned, 'base64').toString('utf-8'); } catch {}
                  }
                  // Strip HTML tags if present
                  rawBody = rawBody.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
                  replyText = rawBody.slice(0, 1000);
                } catch {}
              }

              // Categorize with AI
              const { category, status: newStatus } = replyText.length > 10
                ? await categorizeReply(replyText)
                : { category: 'unknown', status: 'REPLIED' };

              for (const appId of appIds) {
                const app = await prisma.autoApplication.findUnique({ where: { id: appId }, select: { status: true } });
                // Don't downgrade: INTERVIEW > REPLIED
                if (app && app.status !== 'INTERVIEW' && app.status !== 'OFFER') {
                  await prisma.autoApplication.update({
                    where: { id: appId },
                    data: {
                      status: newStatus as any,
                      errorMessage: replyText ? `[${category}] ${replyText.slice(0, 200)}` : null,
                    },
                  });
                  repliedCount++;
                  if (replyText) {
                    console.log(`[ReplyChecker VPS] ${fromEmail} → ${category}: ${replyText.slice(0, 80)}`);
                  }
                }
              }
            }
          } catch {}
        }

        const logoutTag = nextTag();
        await sendImapCommand(socket, logoutTag, 'LOGOUT').catch(() => {});
        clearTimeout(timeout);
        socket.destroy();
        resolve(repliedCount);
      } catch (err) {
        clearTimeout(timeout);
        socket.destroy();
        resolve(0);
      }
    });
  });
}

async function main() {
  console.log(`[ReplyChecker VPS] Starting at ${new Date().toISOString()}`);

  const usersWithSmtp = await prisma.userSmtp.findMany({
    where: { verified: true },
    select: { userId: true, email: true, password: true, host: true },
  });

  // Check which users have recent sent apps
  const usersWithApps = await prisma.autoApplication.findMany({
    where: {
      status: { in: ['SENT', 'DELIVERED', 'OPENED'] },
      sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { userId: true },
    distinct: ['userId'],
  });

  const activeUserIds = new Set(usersWithApps.map(u => u.userId));
  const toCheck = usersWithSmtp.filter(s => activeUserIds.has(s.userId));

  console.log(`[ReplyChecker VPS] Checking ${toCheck.length} users with active applications`);

  let totalReplies = 0;

  for (const smtp of toCheck) {
    try {
      const replies = await checkRepliesForUser(smtp.userId, smtp.email, smtp.password, smtp.host);
      if (replies > 0) {
        console.log(`[ReplyChecker VPS] Found ${replies} replies for ${smtp.email}`);
      }
      totalReplies += replies;
    } catch (err) {
      console.error(`[ReplyChecker VPS] Error for ${smtp.email}:`, String(err).slice(0, 100));
    }

    // 1s delay between users
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[ReplyChecker VPS] Done. Total new replies: ${totalReplies}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('[ReplyChecker VPS] Fatal:', err);
  process.exit(1);
});
