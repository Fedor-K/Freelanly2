// SMTP2GO API client for sending transactional emails
// Docs: https://apidoc.smtp2go.com/

const SMTP2GO_API_URL = 'https://api.smtp2go.com/v3';

interface SMTP2GOConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

const config: SMTP2GOConfig = {
  apiKey: process.env.SMTP2GO_API_KEY || '',
  fromEmail: process.env.SMTP2GO_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'info@freelanly.com',
  fromName: 'Freelanly',
};

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

/**
 * Send email via SMTP2GO API
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.apiKey) {
    console.error('[SMTP2GO] API key not configured');
    return { success: false, error: 'SMTP2GO API key not configured' };
  }

  // Sanitize recipient email
  const sanitizedTo = params.to.toLowerCase().trim().replace(/[\r\n\x00-\x1F]/g, '');
  if (!sanitizedTo.includes('@') || sanitizedTo !== params.to.toLowerCase().trim()) {
    console.error(`[SMTP2GO] Rejected suspicious email: ${params.to}`);
    return { success: false, error: 'Invalid recipient email' };
  }

  try {
    const body: Record<string, unknown> = {
      api_key: config.apiKey,
      sender: `${config.fromName} <${config.fromEmail}>`,
      to: [sanitizedTo],
      subject: params.subject,
      html_body: params.html,
      text_body: params.text || params.html.replace(/<[^>]*>/g, ''),
    };

    if (params.replyTo) {
      body.custom_headers = [{ header: 'Reply-To', value: params.replyTo }];
    }

    if (params.attachments && params.attachments.length > 0) {
      body.attachments = params.attachments.map(att => ({
        filename: att.filename,
        fileblob: att.content,
        mimetype: att.contentType,
      }));
    }

    const response = await fetch(`${SMTP2GO_API_URL}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (data.data?.succeeded > 0) {
      return { success: true, messageId: data.request_id || data.data?.email_id };
    } else {
      const errorMsg = data.data?.error || data.data?.failures?.[0] || `HTTP ${response.status}`;
      console.error(`[SMTP2GO] Failed to send email: ${errorMsg}`);
      return { success: false, error: String(errorMsg) };
    }
  } catch (error) {
    console.error('[SMTP2GO] Send error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if SMTP2GO is configured
 */
export function isConfigured(): boolean {
  return !!config.apiKey;
}

/**
 * Get SMTP2GO configuration (for debugging, no secrets)
 */
export function getConfig() {
  return {
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    isConfigured: isConfigured(),
  };
}
