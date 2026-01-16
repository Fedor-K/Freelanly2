// Email provider abstraction layer
// Supports switching between DashaMail and Resend via EMAIL_PROVIDER env var

import * as dashamail from './dashamail';
import * as resend from './resend';

export type EmailProvider = 'dashamail' | 'resend';

/**
 * Get current email provider from environment
 * Defaults to 'dashamail' for backward compatibility
 */
export function getEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER?.toLowerCase();
  if (provider === 'resend') {
    return 'resend';
  }
  return 'dashamail';
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
 * Send email using the configured provider
 * Main entry point for all email sending in the app
 */
export async function sendApplicationEmail(
  params: SendEmailParams
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const provider = getEmailProvider();

  if (provider === 'resend') {
    if (!resend.isConfigured()) {
      console.warn('[Email] Resend not configured, falling back to DashaMail');
      return dashamail.sendApplicationEmail(params);
    }
    return resend.sendApplicationEmail(params);
  }

  return dashamail.sendApplicationEmail(params);
}

/**
 * Add subscriber to email list (DashaMail only)
 * No-op for Resend (doesn't have list management in same way)
 */
export async function addSubscriber(
  email: string,
  mergeFields?: Record<string, string>
): Promise<boolean> {
  const provider = getEmailProvider();

  if (provider === 'resend') {
    // Resend doesn't have built-in list management like DashaMail
    // Subscribers are managed via Resend Audiences (separate API)
    console.log('[Email] Resend: subscriber management not implemented, skipping');
    return true;
  }

  return dashamail.addSubscriber(email, mergeFields);
}

/**
 * Get email marketing stats (DashaMail only)
 */
export async function getEmailMarketingStats() {
  const provider = getEmailProvider();

  if (provider === 'resend') {
    console.log('[Email] Resend: marketing stats not available via this API');
    return {
      subscribers: null,
      lastCampaigns: [],
      avgOpenRate: 0,
      avgClickRate: 0,
    };
  }

  return dashamail.getEmailMarketingStats();
}

/**
 * Get transactional email stats
 */
export async function getTransactionalStats(days: number = 30) {
  const provider = getEmailProvider();

  if (provider === 'resend') {
    // Would need to implement Resend analytics API
    console.log('[Email] Resend: transactional stats require separate API call');
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

  return dashamail.getTransactionalStats(days);
}

/**
 * Test email provider connection
 */
export async function testConnection(): Promise<boolean> {
  const provider = getEmailProvider();

  if (provider === 'resend') {
    return resend.isConfigured();
  }

  return dashamail.testDashaMailConnection();
}

/**
 * Get current provider info for debugging
 */
export function getProviderInfo() {
  const provider = getEmailProvider();

  return {
    provider,
    dashamail: {
      fromEmail: dashamail.dashamailConfig.fromEmail,
      isConfigured: !!dashamail.dashamailConfig.apiKey,
    },
    resend: resend.getConfig(),
  };
}

// Re-export specific provider modules for direct access if needed
export { dashamail, resend };

// Re-export commonly used functions from DashaMail for backward compatibility
export { generateApplicationEmailHtml } from './dashamail';
export type { EmailCampaignStats, SubscriberStats, TransactionalStats } from './dashamail';
