// Postal self-hosted mail server client
// API docs: https://docs.postalserver.io/developer/api

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
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
}

/**
 * Send email via Postal API
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.apiKey) {
    console.error('[Postal] API key not configured');
    return { success: false, error: 'Postal API key not configured' };
  }

  const sanitizedTo = params.to.toLowerCase().trim().replace(/[\r\n\x00-\x1F]/g, '');
  if (!sanitizedTo.includes('@') || sanitizedTo !== params.to.toLowerCase().trim()) {
    console.error(`[Postal] Rejected suspicious email: ${params.to}`);
    return { success: false, error: 'Invalid recipient email' };
  }

  try {
    const body: Record<string, unknown> = {
      to: [sanitizedTo],
      from: `${config.fromName} <${config.fromEmail}>`,
      subject: params.subject,
      html_body: params.html,
      plain_body: params.text || params.html.replace(/<[^>]*>/g, ''),
    };

    if (params.replyTo) {
      body.reply_to = params.replyTo;
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
      const msgData = data.data?.messages?.[sanitizedTo];
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
