import { createHmac } from 'crypto';
import { siteConfig } from '@/config/site';

const SECRET = process.env.AUTH_SECRET || 'fallback-secret';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;

/**
 * Generate unsubscribe token for email
 */
export function generateUnsubscribeToken(email: string): string {
  return createHmac('sha256', SECRET)
    .update(email.toLowerCase())
    .digest('hex')
    .substring(0, 32);
}

/**
 * Verify unsubscribe token
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expectedToken = generateUnsubscribeToken(email);
  return token === expectedToken;
}

/**
 * Generate full unsubscribe URL with token
 */
export function getUnsubscribeUrl(email: string): string {
  const token = generateUnsubscribeToken(email);
  return `${APP_URL}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

/**
 * Generate HTML footer with unsubscribe link for emails
 */
export function getUnsubscribeFooterHtml(email: string): string {
  const unsubscribeUrl = getUnsubscribeUrl(email);
  return `
    <p style="margin: 10px 0 0; font-size: 12px; color: #666;">
      <a href="${unsubscribeUrl}" style="color: #666; text-decoration: underline;">
        Unsubscribe from these emails
      </a>
    </p>
  `;
}
