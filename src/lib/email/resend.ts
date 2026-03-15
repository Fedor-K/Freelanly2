// Resend API client for sending transactional emails
// Docs: https://resend.com/docs

const RESEND_API_URL = 'https://api.resend.com';

interface ResendConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

const config: ResendConfig = {
  apiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.RESEND_FROM_EMAIL || 'info@freelanly.com',
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
    content: string; // base64 encoded
    contentType: string;
  }>;
}

interface ResendResponse {
  id?: string;
  error?: {
    message: string;
    name: string;
  };
}

/**
 * Send email via Resend API
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.apiKey) {
    console.error('[Resend] API key not configured');
    return { success: false, error: 'Resend API key not configured' };
  }

  try {
    const body: Record<string, unknown> = {
      from: `${config.fromName} <${config.fromEmail}>`,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text || params.html.replace(/<[^>]*>/g, ''),
    };

    if (params.replyTo) {
      body.reply_to = params.replyTo;
    }

    if (params.attachments && params.attachments.length > 0) {
      body.attachments = params.attachments.map(att => ({
        filename: att.filename,
        content: att.content,
        content_type: att.contentType,
      }));
    }

    const response = await fetch(`${RESEND_API_URL}/emails`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data: ResendResponse = await response.json();

    if (response.ok && data.id) {
      return { success: true, messageId: data.id };
    } else {
      const errorMsg = data.error?.message || `HTTP ${response.status}`;
      console.error(`[Resend] Failed to send email: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('[Resend] Send error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Alias for compatibility with existing code
 */
export const sendApplicationEmail = sendEmail;

/**
 * Check if Resend is configured
 */
export function isConfigured(): boolean {
  return !!config.apiKey;
}

/**
 * Get Resend configuration (for debugging)
 */
export function getConfig() {
  return {
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    isConfigured: !!config.apiKey,
  };
}

export { config as resendConfig };
