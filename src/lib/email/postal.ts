// Postal self-hosted mail server client
// API docs: https://docs.postalserver.io/developer/api
import { getRecruiterUnsubscribeUrl } from '@/lib/recruiter-token';

interface PostalConfig {
  apiUrl: string;
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

const config: PostalConfig = {
  apiUrl: (process.env.POSTAL_API_URL || 'https://postal.freelanly.com').trim(),
  apiKey: (process.env.POSTAL_API_KEY || '').trim(),
  fromEmail: (process.env.POSTAL_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'info@freelanly.com').trim(),
  fromName: 'Freelanly',
};

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  /** Override the From address/name — e.g. cold outreach from an ISOLATED domain
   * (talent.freelanly.com) so its reputation can't reach the OTP/apply domain. Defaults to POSTAL_FROM_EMAIL. */
  from?: string;
  fromName?: string;
  /** One-click List-Unsubscribe target (RFC 8058). Set for bulk/marketing sends to recruiters. */
  listUnsubscribe?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

/**
 * Send a TRANSACTIONAL email (OTP, recap, watcher OTP/alerts).
 * Primary transport is Resend when RESEND_API_KEY is set — Postal's self-hosted IP kept getting
 * no-PTR / blocklist rejections that silently killed OTP delivery. On any Resend failure we fall
 * back to Postal so a misconfig can't hard-block auth codes. apply@ cold outreach does NOT use this
 * — it stays on Postal (sendAutoApplyViaPostal), since managed ESPs ban cold email.
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const sanitizedTo = params.to.toLowerCase().trim().replace(/[\r\n\x00-\x1F]/g, '');
  if (!sanitizedTo.includes('@') || sanitizedTo !== params.to.toLowerCase().trim()) {
    console.error(`[Email] Rejected suspicious email: ${params.to}`);
    return { success: false, error: 'Invalid recipient email' };
  }

  const fromEmail = params.from || config.fromEmail;
  const fromName = params.fromName || config.fromName;
  const outbound: SendEmailParams = { ...params, to: sanitizedTo };

  if ((process.env.RESEND_API_KEY || '').trim()) {
    const r = await sendViaResend(outbound, fromEmail, fromName);
    if (r.success) return r;
    console.error(`[Email] Resend failed (${r.error}); falling back to Postal`);
  }

  return sendViaPostal(outbound, fromEmail, fromName);
}

/** Resend transport (managed deliverability). Domain of `fromEmail` must be verified in Resend. */
async function sendViaResend(params: SendEmailParams, fromEmail: string, fromName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const body: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]*>/g, ''),
    };
    if (params.replyTo) body.reply_to = params.replyTo;
    if (params.listUnsubscribe) {
      body.headers = {
        'List-Unsubscribe': `<${params.listUnsubscribe}>, <mailto:unsubscribe@freelanly.com?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      };
    }
    if (params.attachments && params.attachments.length > 0) {
      body.attachments = params.attachments.map(att => ({ filename: att.filename, content: att.content }));
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${(process.env.RESEND_API_KEY || '').trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.id) return { success: true, messageId: String(data.id) };
    return { success: false, error: String(data?.message || data?.name || `HTTP ${res.status}`) };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/** Postal transport (self-hosted). Fallback for transactional; primary for apply@ outreach. */
async function sendViaPostal(params: SendEmailParams, fromEmail: string, fromName: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.apiKey) {
    console.error('[Postal] API key not configured');
    return { success: false, error: 'No email provider configured' };
  }
  try {
    const body: Record<string, unknown> = {
      to: [params.to],
      from: `${fromName} <${fromEmail}>`,
      subject: params.subject,
      html_body: params.html,
      plain_body: params.text || params.html.replace(/<[^>]*>/g, ''),
    };

    if (params.replyTo) {
      body.reply_to = params.replyTo;
    }

    if (params.listUnsubscribe) {
      body.headers = {
        'List-Unsubscribe': `<${params.listUnsubscribe}>, <mailto:unsubscribe@freelanly.com?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      };
    }

    if (params.attachments && params.attachments.length > 0) {
      body.attachments = params.attachments.map(att => ({
        name: att.filename,
        content_type: att.contentType,
        data: att.content,
      }));
    }

    const response = await fetch(`${config.apiUrl}/api/v1/send/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-API-Key': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.status === 'success') {
      const msgData = data.data?.messages?.[params.to];
      return { success: true, messageId: data.data?.message_id || msgData?.token };
    } else {
      const errorMsg = data.data?.message || data.status || `HTTP ${response.status}`;
      console.error(`[Postal] Failed to send email: ${errorMsg}`);
      return { success: false, error: String(errorMsg) };
    }
  } catch (error) {
    console.error('[Postal] Send error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Send auto-apply email via Postal on behalf of a user.
 * From: "UserName via Freelanly" <apply@freelanly.com>
 * Reply-To: user's personal email
 */
export async function sendAutoApplyViaPostal(params: {
  userName: string;
  userEmail: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  applicationId?: string;
  attachmentBase64?: string;
  attachmentFilename?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.apiKey) {
    return { success: false, error: 'Postal not configured' };
  }

  const fromEmail = 'apply@freelanly.com';
  const fromName = params.userName;
  // Reply routing: replies go to reply+{appId}@reply.freelanly.com → webhook → forward to user
  const replyTo = params.applicationId
    ? `reply+${params.applicationId}@reply.freelanly.com`
    : params.userEmail;

  // Safety net: the user's real email must NEVER reach the recruiter (replies
  // route through reply+{appId}@). Strip it from the body in case it leaked in
  // from an AI-generated signature or a résumé snippet.
  const stripUserEmail = (s: string): string => {
    if (!s || !params.userEmail) return s;
    const esc = params.userEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return s.replace(new RegExp(esc, 'gi'), '');
  };

  try {
    // One-click List-Unsubscribe (RFC 8058). Required by Gmail/Yahoo bulk-sender rules and a
    // strong inbox-placement signal — apply@ sends at volume, so this matters. The target honors
    // the opt-out server-side (see /api/recruiter/unsubscribe + RecruiterSuppression).
    const unsubUrl = getRecruiterUnsubscribeUrl(params.to);
    const body: Record<string, unknown> = {
      to: [params.to.toLowerCase().trim()],
      from: `${fromName} <${fromEmail}>`,
      reply_to: replyTo,
      subject: params.subject,
      html_body: stripUserEmail(params.html),
      plain_body: stripUserEmail(params.text),
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>, <mailto:unsubscribe@freelanly.com?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    };

    if (params.attachmentBase64 && params.attachmentFilename) {
      body.attachments = [{
        name: params.attachmentFilename,
        content_type: 'application/pdf',
        data: params.attachmentBase64,
      }];
    }

    const response = await fetch(`${config.apiUrl}/api/v1/send/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Server-API-Key': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.status === 'success') {
      const msgData = data.data?.messages?.[params.to.toLowerCase().trim()];
      return { success: true, messageId: data.data?.message_id || msgData?.token };
    } else {
      return { success: false, error: data.data?.message || data.status };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Check if Postal is configured
 */
export function isConfigured(): boolean {
  return !!config.apiKey;
}

/**
 * Get Postal configuration (for debugging, no secrets)
 */
export function getConfig() {
  return {
    apiUrl: config.apiUrl,
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    isConfigured: isConfigured(),
  };
}
