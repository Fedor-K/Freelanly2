// Resend email client
// Docs: https://resend.com/docs

import { Resend } from 'resend';

// Lazy initialization to avoid build-time errors
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

const DEFAULT_FROM = process.env.EMAIL_FROM || 'Freelanly <noreply@freelanly.com>';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  from?: string;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send transactional email via Resend
 * Compatible with previous DashaMail interface
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  try {
    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
      from: params.from || DEFAULT_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
    });

    if (error) {
      console.error('[Resend] Error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error('[Resend] Exception:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Alias for backward compatibility with DashaMail
 */
export const sendApplicationEmail = sendEmail;

/**
 * Send magic link email for authentication
 */
export async function sendMagicLinkEmail(
  email: string,
  url: string
): Promise<void> {
  const html = generateMagicLinkHtml(url);
  const text = generateMagicLinkText(url);

  const result = await sendEmail({
    to: email,
    subject: 'Sign in to Freelanly',
    html,
    text,
  });

  if (!result.success) {
    console.error('[Resend] Failed to send magic link:', result.error);
    throw new Error(`Failed to send email: ${result.error}`);
  }

  console.log(`[Resend] Magic link sent to ${email}, id: ${result.messageId}`);
}

/**
 * Add subscriber - no-op for Resend (we use our own database)
 * Kept for backward compatibility
 */
export async function addSubscriber(
  _email: string,
  _mergeFields?: Record<string, string>
): Promise<boolean> {
  // Resend doesn't have subscriber lists like DashaMail
  // We manage subscribers in our own database
  return true;
}

// ============================================
// EMAIL TEMPLATES
// ============================================

function generateMagicLinkHtml(url: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      background-color: #f5f5f5;
      margin: 0;
      padding: 20px;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .logo {
      font-size: 24px;
      font-weight: 700;
      color: #000;
      margin-bottom: 32px;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      margin: 0 0 16px 0;
    }
    p {
      color: #4a4a4a;
      margin: 0 0 24px 0;
    }
    .button {
      display: inline-block;
      background: #000;
      color: #fff !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
    }
    .button:hover {
      background: #333;
    }
    .footer {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #eee;
      font-size: 13px;
      color: #888;
    }
    .link {
      color: #888;
      word-break: break-all;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Freelanly</div>

    <h1>Sign in to your account</h1>

    <p>Click the button below to sign in to your account. This link is valid for 24 hours.</p>

    <a href="${url}" class="button">Sign in to Freelanly</a>

    <div class="footer">
      <p>If the button doesn't work, copy this link to your browser:</p>
      <p class="link">${url}</p>
      <p style="margin-top: 16px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateMagicLinkText(url: string): string {
  return `
Sign in to Freelanly

Click the link below to sign in to your account:

${url}

This link is valid for 24 hours.

If you didn't request this, you can safely ignore this email.

---
Freelanly - Remote Jobs
https://freelanly.com
  `.trim();
}

// ============================================
// STATISTICS - Stub functions for backward compatibility
// TODO: Implement via Resend webhooks for real stats
// ============================================

export interface EmailCampaignStats {
  campaignId: string;
  name: string;
  sentAt: string;
  totalSent: number;
  delivered: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  bounced: number;
  openRate: number;
  clickRate: number;
}

export interface SubscriberStats {
  total: number;
  active: number;
  unsubscribed: number;
  bounced: number;
}

export interface TransactionalStats {
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  complained: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
}

/**
 * Get subscriber stats - stub for Resend (we use our own DB)
 */
export async function getSubscriberStats(): Promise<SubscriberStats | null> {
  // TODO: Implement from our own database
  return { total: 0, active: 0, unsubscribed: 0, bounced: 0 };
}

/**
 * Get campaigns list - stub for Resend
 */
export async function getCampaignsList(_limit: number = 10): Promise<EmailCampaignStats[]> {
  return [];
}

/**
 * Get campaign stats - stub for Resend
 */
export async function getCampaignStats(_campaignId: string): Promise<EmailCampaignStats | null> {
  return null;
}

/**
 * Get email marketing stats - stub for Resend
 */
export async function getEmailMarketingStats(): Promise<{
  subscribers: SubscriberStats | null;
  lastCampaigns: EmailCampaignStats[];
  avgOpenRate: number;
  avgClickRate: number;
}> {
  return {
    subscribers: null,
    lastCampaigns: [],
    avgOpenRate: 0,
    avgClickRate: 0,
  };
}

/**
 * Get transactional stats - stub for Resend
 * TODO: Implement via Resend webhooks
 */
export async function getTransactionalStats(_days: number = 30): Promise<TransactionalStats> {
  return {
    sent: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
    complained: 0,
    openRate: 0,
    clickRate: 0,
    bounceRate: 0,
  };
}

/**
 * Test connection - always returns true for Resend
 */
export async function testResendConnection(): Promise<boolean> {
  return !!process.env.RESEND_API_KEY;
}

// Alias for backward compatibility
export const testDashaMailConnection = testResendConnection;

// ============================================
// LEGACY COMPATIBILITY - Generate application email HTML
// ============================================

export function generateApplicationEmailHtml(params: {
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  coverLetter: string;
  resumeUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 2px solid #000; padding-bottom: 20px; margin-bottom: 20px; }
    .footer { border-top: 1px solid #eee; padding-top: 20px; margin-top: 20px; font-size: 12px; color: #666; }
    h1 { font-size: 24px; margin: 0; }
    .meta { color: #666; font-size: 14px; }
    .cover-letter { white-space: pre-wrap; }
    .button { display: inline-block; background: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Application: ${params.jobTitle}</h1>
      <p class="meta">From: ${params.candidateName} (${params.candidateEmail})</p>
    </div>

    <div class="cover-letter">
${params.coverLetter}
    </div>

    ${params.resumeUrl ? `
    <p>
      <a href="${params.resumeUrl}" class="button">View Resume</a>
    </p>
    ` : ''}

    <div class="footer">
      <p>This application was sent via <a href="https://freelanly.com">Freelanly</a></p>
      <p>Reply directly to this email to contact the candidate.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
