// Elastic Email API client for sending transactional emails
// Docs: https://elasticemail.com/developers/api-documentation/rest-api

const ELASTIC_API_URL = 'https://api.elasticemail.com/v2';

interface ElasticEmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

const config: ElasticEmailConfig = {
  apiKey: (process.env.ELASTIC_EMAIL_API_KEY || '').trim(),
  fromEmail: (process.env.ELASTIC_EMAIL_FROM || process.env.RESEND_FROM_EMAIL || 'info@freelanly.com').trim(),
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
 * Send email via Elastic Email API v2
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.apiKey) {
    console.error('[ElasticEmail] API key not configured');
    return { success: false, error: 'Elastic Email API key not configured' };
  }

  const sanitizedTo = params.to.toLowerCase().trim().replace(/[\r\n\x00-\x1F]/g, '');
  if (!sanitizedTo.includes('@') || sanitizedTo !== params.to.toLowerCase().trim()) {
    console.error(`[ElasticEmail] Rejected suspicious email: ${params.to}`);
    return { success: false, error: 'Invalid recipient email' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('apikey', config.apiKey);
    formData.append('from', config.fromEmail);
    formData.append('fromName', config.fromName);
    formData.append('to', sanitizedTo);
    formData.append('subject', params.subject);
    formData.append('bodyHtml', params.html);
    formData.append('bodyText', params.text || params.html.replace(/<[^>]*>/g, ''));

    if (params.replyTo) {
      formData.append('replyTo', params.replyTo);
    }

    const response = await fetch(`${ELASTIC_API_URL}/email/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const data = await response.json();

    if (data.success) {
      return { success: true, messageId: data.data?.messageid || data.data?.transactionid };
    } else {
      const errorMsg = data.error || `HTTP ${response.status}`;
      console.error(`[ElasticEmail] Failed to send email: ${errorMsg}`);
      return { success: false, error: String(errorMsg) };
    }
  } catch (error) {
    console.error('[ElasticEmail] Send error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if Elastic Email is configured
 */
export function isConfigured(): boolean {
  return !!config.apiKey;
}

/**
 * Get config (for debugging, no secrets)
 */
export function getConfig() {
  return {
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    isConfigured: isConfigured(),
  };
}
