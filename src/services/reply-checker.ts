import * as tls from 'tls';
import { prisma } from '@/lib/db';
import { AutoApplyStatus } from '@prisma/client';

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
    }, 15000);

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
async function searchForReplies(
  imapHost: string,
  email: string,
  password: string,
  subjects: { applicationId: string; subject: string }[]
): Promise<{ applicationId: string; replied: boolean }[]> {
  const results: { applicationId: string; replied: boolean }[] = [];

  if (subjects.length === 0) return results;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('IMAP connection timeout'));
    }, 30000);

    const socket = tls.connect(993, imapHost, { rejectUnauthorized: false });

    let greeting = '';
    let tagCounter = 1;
    const nextTag = () => `A${String(tagCounter++).padStart(3, '0')}`;

    socket.once('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    socket.once('data', async (data) => {
      greeting = data.toString();
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

        // Search for each subject (look for "Re: <subject>")
        for (const { applicationId, subject } of subjects) {
          try {
            // Clean subject for IMAP search (remove special chars, limit length)
            const cleanSubject = subject
              .replace(/["\\\r\n]/g, '')
              .slice(0, 60);

            const searchTag = nextTag();
            const sinceDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
            const dateStr = sinceDate.toLocaleDateString('en-US', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            }).replace(',', '');
            // Format: DD-Mon-YYYY for IMAP
            const imapDate = `${sinceDate.getDate()}-${sinceDate.toLocaleString('en-US', { month: 'short' })}-${sinceDate.getFullYear()}`;

            const searchResp = await sendImapCommand(
              socket,
              searchTag,
              `SEARCH SUBJECT "Re: ${cleanSubject}" SINCE ${imapDate}`
            );

            // Parse SEARCH response: "* SEARCH 1 2 3" means messages found
            const searchLine = searchResp
              .split('\r\n')
              .find((l) => l.startsWith('* SEARCH'));
            const hasResults =
              searchLine !== undefined &&
              searchLine.trim() !== '* SEARCH' &&
              searchLine.replace('* SEARCH', '').trim().length > 0;

            results.push({ applicationId, replied: hasResults });
          } catch {
            results.push({ applicationId, replied: false });
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
      subject: { not: '' },
    },
    select: { id: true, subject: true },
    take: 20, // Limit to avoid long IMAP sessions
  });

  if (recentApps.length === 0) return 0;

  const imapHost = smtpToImapHost(smtp.host);
  const subjects = recentApps.map((app) => ({
    applicationId: app.id,
    subject: app.subject || '',
  }));

  try {
    const results = await searchForReplies(imapHost, smtp.email, smtp.password, subjects);

    let repliedCount = 0;
    for (const result of results) {
      if (result.replied) {
        await prisma.autoApplication.update({
          where: { id: result.applicationId },
          data: { status: AutoApplyStatus.REPLIED },
        });
        repliedCount++;
        console.log(`[ReplyChecker] Application ${result.applicationId} marked as REPLIED`);
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

  for (const { userId } of usersWithSentApps) {
    try {
      const replies = await checkRepliesForUser(userId);
      totalReplies += replies;
    } catch (error) {
      console.error(`[ReplyChecker] Failed for user ${userId}:`, error);
    }

    // Rate limit between users
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return totalReplies;
}
