import { buildMimeMessage, generateMessageId, type SendEmailOptions, type SmtpResult } from './smtp-sender';
import { accessTokenFromRefresh } from './gmail-oauth';
import { decryptToken } from './token-crypto';

const GMAIL_SEND_ENDPOINT = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';

/**
 * Send an application email from the user's OWN Gmail via the Gmail API (users.messages.send), using
 * their stored `gmail.send` refresh token. Same options + result shape as sendEmailViaSMTP, so the send
 * call-sites can pick this branch with an identical contract. Reuses buildMimeMessage so the wire format
 * (multipart/mixed with the CV, or multipart/alternative) matches the SMTP path exactly.
 */
export async function sendViaGmail(
  gmailAuth: { email: string; refreshToken: string },
  options: SendEmailOptions
): Promise<SmtpResult> {
  const refreshToken = decryptToken(gmailAuth.refreshToken); // stored encrypted at rest; legacy plaintext passes through
  const accessToken = refreshToken ? await accessTokenFromRefresh(refreshToken) : null;
  if (!accessToken) {
    // refresh token revoked/expired, or OAuth client misconfigured → caller should prompt reconnect
    return { success: false, error: 'gmail_token_invalid' };
  }

  const domain = gmailAuth.email.split('@')[1] || 'gmail.com';
  const messageId = generateMessageId(domain);
  const attachment =
    options.attachmentBase64 && options.attachmentFilename
      ? { data: options.attachmentBase64, filename: options.attachmentFilename }
      : null;

  const mime = buildMimeMessage({
    from: options.from,
    to: options.to,
    replyTo: options.replyTo,
    subject: options.subject,
    html: options.html,
    text: options.text,
    messageId,
    attachment,
  });

  const raw = Buffer.from(mime).toString('base64url');

  try {
    const res = await fetch(GMAIL_SEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { success: false, error: `gmail_send_${res.status}: ${body.slice(0, 200)}` };
    }
    const data = await res.json().catch(() => ({}));
    return { success: true, messageId: data.id || messageId };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'gmail_send_failed' };
  }
}
