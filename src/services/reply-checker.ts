import * as tls from 'tls';
import { prisma } from '@/lib/db';
import { AutoApplyStatus } from '@prisma/client';
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
function extractBodyFromFetch(fetchResp: string): string {
  // Look for literal size marker {NNN} then grab the content
  const literalMatch = fetchResp.match(/\{(\d+)\}\r\n/);
  if (literalMatch) {
    const size = parseInt(literalMatch[1], 10);
    const start = fetchResp.indexOf(literalMatch[0]) + literalMatch[0].length;
    let body = fetchResp.slice(start, start + size);
    // Decode base64 if needed
    if (/^[A-Za-z0-9+/=\r\n]+$/.test(body.trim()) && body.length > 50) {
      try { body = Buffer.from(body.replace(/\r?\n/g, ''), 'base64').toString('utf-8'); } catch {}
    }
    // Decode quoted-printable =XX sequences
    body = body.replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    body = body.replace(/=\r?\n/g, '');
    return body.trim();
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
    }, 15000);

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
  // Get user's SMTP config
  const smtp = await prisma.userSmtp.findUnique({
    where: { userId },
  });

  if (!smtp || !smtp.verified) return 0;

  // Get recent SENT/DELIVERED/OPENED applications (last 14 days)
  const recentApps = await prisma.autoApplication.findMany({
    where: {
      userId,
      status: { in: [AutoApplyStatus.SENT, AutoApplyStatus.DELIVERED, AutoApplyStatus.OPENED] },
      sentAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
    },
    select: { id: true, subject: true, appliedToEmail: true },
    take: 30,
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
        const replyText = result.replyText || '';
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
        console.log(`[ReplyChecker] ${result.applicationId} → ${category}: ${replyText.slice(0, 80)}`);
      }
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

  // Limit to 3 users per run to stay within Vercel function timeout
  // Rotate by using current minute to offset — different users checked each run
  const offset = Math.floor(Date.now() / (15 * 60 * 1000)) % Math.max(usersWithSentApps.length, 1);
  const rotated = [...usersWithSentApps.slice(offset), ...usersWithSentApps.slice(0, offset)];
  const usersToCheck = rotated.slice(0, 3);
  console.log(`[ReplyChecker] Checking ${usersToCheck.length} of ${usersWithSentApps.length} users`);

  for (const { userId } of usersToCheck) {
    try {
      const replies = await checkRepliesForUser(userId);
      totalReplies += replies;
      if (replies > 0) {
        console.log(`[ReplyChecker] Found ${replies} replies for user ${userId}`);
      }
    } catch (error) {
      console.error(`[ReplyChecker] Failed for user ${userId}:`, String(error).slice(0, 200));
    }

    // Rate limit between users
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return totalReplies;
}
