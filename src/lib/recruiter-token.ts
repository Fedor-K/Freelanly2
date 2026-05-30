import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { siteConfig } from '@/config/site';

// Signed, URL-safe token that encodes a recruiter's email so the candidate-list page
// (/r/[token]) can be opened straight from an application email — no login required.
// Mirrors the HMAC approach in unsubscribe.ts. Format: base64url(email).signature
const SECRET = process.env.AUTH_SECRET || randomBytes(32).toString('hex');

function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('hex').slice(0, 32);
}

export function signRecruiterToken(email: string): string {
  const e = email.toLowerCase().trim();
  return `${Buffer.from(e).toString('base64url')}.${sign(e)}`;
}

/** Returns the recruiter email if the token is valid, else null. */
export function verifyRecruiterToken(token: string): string | null {
  const [payload, sig] = (token || '').split('.');
  if (!payload || !sig) return null;
  let email: string;
  try {
    email = Buffer.from(payload, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  if (!email.includes('@')) return null;
  const a = Buffer.from(sign(email));
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return email;
}

/** Full URL to drop into the application email. */
export function getRecruiterPortalUrl(email: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;
  return `${base}/r/${signRecruiterToken(email)}`;
}

/** One-click List-Unsubscribe target (RFC 8058). Same signed token encodes the email. */
export function getRecruiterUnsubscribeUrl(email: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;
  return `${base}/api/recruiter/unsubscribe?t=${signRecruiterToken(email)}`;
}
