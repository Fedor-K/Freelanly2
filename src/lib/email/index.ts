// Email provider: switchable via EMAIL_PROVIDER env var
// Supported: 'resend' (default), 'ses' (Amazon SES), 'smtp2go'
// Fallback: if primary fails and SMTP2GO_API_KEY is set, retries via SMTP2GO

import * as resend from './resend';
import * as ses from './ses';
import * as smtp2go from './smtp2go';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

const provider = process.env.EMAIL_PROVIDER || 'resend';

function getProvider() {
  if (provider === 'ses') return ses;
  if (provider === 'smtp2go') return smtp2go;
  return resend;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const result = await getProvider().sendEmail(params);

  // Fallback to SMTP2GO if primary provider fails and SMTP2GO is configured
  if (!result.success && smtp2go.isConfigured() && provider !== 'smtp2go') {
    console.warn(`[Email] Primary provider (${provider}) failed: ${result.error}. Falling back to SMTP2GO.`);
    return smtp2go.sendEmail(params);
  }

  return result;
}

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

/**
 * Send email via configured provider — with activity logging
 */
export async function sendApplicationEmail(
  params: SendEmailParams & { emailType?: string; userId?: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const result = await sendEmail(params);

  // Log EMAIL_SENT to ActivityLog (non-blocking)
  if (result.success) {
    // Try to find userId by email if not provided
    const userId = params.userId || await prisma.user.findUnique({
      where: { email: params.to.toLowerCase() },
      select: { id: true },
    }).then(u => u?.id || null).catch(() => null);

    if (userId) {
      prisma.activityLog.create({
        data: {
          userId,
          action: ActivityAction.EMAIL_SENT,
          details: {
            type: params.emailType || detectEmailType(params.subject),
            subject: params.subject,
            to: params.to,
          },
        },
      }).catch(() => {});
    }
  }

  return result;
}

/**
 * Detect email type from subject line
 */
function detectEmailType(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes('new freelance') || s.includes('project') || s.includes('matched')) return 'alert';
  if (s.includes('magic link') || s.includes('sign in')) return 'magic_link';
  if (s.includes('welcome') || s.includes('getting started')) return 'activation';
  if (s.includes('trial')) return 'trial';
  if (s.includes('miss you') || s.includes('come back') || s.includes('win-back')) return 'winback';
  if (s.includes('checkout') || s.includes('cart') || s.includes('payment')) return 'abandoned_checkout';
  if (s.includes('application')) return 'application';
  return 'other';
}

/**
 * Subscriber management — no-op (Resend doesn't have built-in list management)
 */
export async function addSubscriber(
  _email: string,
  _mergeFields?: Record<string, string>
): Promise<boolean> {
  return true;
}

/**
 * Email marketing stats — not available via Resend basic API
 */
export async function getEmailMarketingStats() {
  return {
    subscribers: null as SubscriberStats | null,
    lastCampaigns: [] as EmailCampaignStats[],
    avgOpenRate: 0,
    avgClickRate: 0,
  };
}

/**
 * Transactional email stats — not available via Resend basic API
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
 * Check if email provider is configured
 */
export async function testConnection(): Promise<boolean> {
  return getProvider().isConfigured();
}

/**
 * Get provider info for debugging
 */
export function getProviderInfo() {
  const p = getProvider();
  return { provider, config: p.getConfig(), fallback: smtp2go.isConfigured() ? 'smtp2go' : 'none' };
}

// ============================================
// HTML GENERATOR
// ============================================

/**
 * Generate HTML for job application emails
 */
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

// ============================================
// TYPES (kept for backward compatibility)
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
