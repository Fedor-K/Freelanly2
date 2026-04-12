// Amazon SES client for sending transactional emails
// Docs: https://docs.aws.amazon.com/ses/latest/APIReference/API_SendEmail.html
// Uses SES v2 API via HTTP (no SDK dependency needed)

import { createHmac, createHash } from 'crypto';

interface SESConfig {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  fromEmail: string;
  fromName: string;
}

const config: SESConfig = {
  accessKeyId: (process.env.AWS_SES_ACCESS_KEY_ID || '').trim(),
  secretAccessKey: (process.env.AWS_SES_SECRET_ACCESS_KEY || '').trim(),
  region: (process.env.AWS_SES_REGION || 'us-east-1').trim(),
  fromEmail: (process.env.SES_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'info@freelanly.com').trim(),
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
 * AWS Signature V4 signing
 */
function sign(key: Buffer, msg: string): Buffer {
  return createHmac('sha256', key).update(msg).digest();
}

function getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
  const kDate = sign(Buffer.from('AWS4' + key), dateStamp);
  const kRegion = sign(kDate, region);
  const kService = sign(kRegion, service);
  return sign(kService, 'aws4_request');
}

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Send email via Amazon SES v2 API (SendEmail)
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!config.accessKeyId || !config.secretAccessKey) {
    console.error('[SES] AWS credentials not configured');
    return { success: false, error: 'AWS SES credentials not configured' };
  }

  // Sanitize recipient email
  const sanitizedTo = params.to.toLowerCase().trim().replace(/[\r\n\x00-\x1F]/g, '');
  if (!sanitizedTo.includes('@') || sanitizedTo !== params.to.toLowerCase().trim()) {
    console.error(`[SES] Rejected suspicious email: ${params.to}`);
    return { success: false, error: 'Invalid recipient email' };
  }

  try {
    const host = `email.${config.region}.amazonaws.com`;
    const endpoint = `https://${host}/v2/email/outbound-emails`;

    const body = JSON.stringify({
      Content: {
        Simple: {
          Subject: { Data: params.subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: params.html, Charset: 'UTF-8' },
            Text: { Data: params.text || params.html.replace(/<[^>]*>/g, ''), Charset: 'UTF-8' },
          },
        },
      },
      Destination: {
        ToAddresses: [sanitizedTo],
      },
      FromEmailAddress: `${config.fromName} <${config.fromEmail}>`,
      ...(params.replyTo ? { ReplyToAddresses: [params.replyTo] } : {}),
    });

    // AWS Signature V4
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${config.region}/ses/aws4_request`;

    const canonicalHeaders = [
      `content-type:application/json`,
      `host:${host}`,
      `x-amz-date:${amzDate}`,
    ].join('\n') + '\n';

    const signedHeaders = 'content-type;host;x-amz-date';
    const payloadHash = sha256(body);

    const canonicalRequest = [
      'POST',
      '/v2/email/outbound-emails',
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join('\n');

    const signingKey = getSignatureKey(config.secretAccessKey, dateStamp, config.region, 'ses');
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId.trim()}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Amz-Date': amzDate,
        'Authorization': authHeader,
      },
      body,
    });

    const data = await response.json();

    if (response.ok && data.MessageId) {
      return { success: true, messageId: data.MessageId };
    } else {
      const errorMsg = data.message || data.Message || `HTTP ${response.status}`;
      console.error(`[SES] Failed to send email: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('[SES] Send error:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Check if SES is configured
 */
export function isConfigured(): boolean {
  return !!config.accessKeyId && !!config.secretAccessKey;
}

/**
 * Get SES configuration (for debugging, no secrets)
 */
export function getConfig() {
  return {
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    region: config.region,
    isConfigured: isConfigured(),
  };
}
