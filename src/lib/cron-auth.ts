import { NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

/** Constant-time string compare (returns false on length mismatch). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Validate cron request. Two accepted auth methods, both secret-based:
 * 1. Authorization: Bearer <CRON_SECRET> (external calls + Vercel crons)
 * 2. x-vercel-cron-secret: <CRON_SECRET> header
 *
 * NOTE: the legacy `x-replit-cron: true` header and `?token=` query param were
 * removed — the header allowed an unauthenticated bypass and the query param
 * leaked the secret into logs. All callers use the Bearer header.
 */
export function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.log('[Cron Auth] CRON_SECRET not set');
    return false;
  }

  // Method 1: Standard Bearer token (external calls like curl, Vercel crons)
  const authHeader = request.headers.get('authorization');
  if (authHeader && safeEqual(authHeader, `Bearer ${cronSecret}`)) {
    return true;
  }

  // Method 2: Vercel cron secret header
  const vercelCronSecret = request.headers.get('x-vercel-cron-secret');
  if (vercelCronSecret && safeEqual(vercelCronSecret, cronSecret)) {
    return true;
  }

  return false;
}

/**
 * Log unauthorized cron attempt for debugging
 */
export function logUnauthorizedCronAttempt(request: NextRequest): void {
  const authHeader = request.headers.get('authorization');
  console.log('[Cron Auth] Unauthorized attempt');
  console.log('[Cron Auth] Auth header:', authHeader ? authHeader.substring(0, 25) + '...' : 'none');

  // Log all headers for debugging (excluding sensitive values)
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'authorization') {
      headers[key] = value.substring(0, 25) + '...';
    } else if (key.toLowerCase() === 'cookie') {
      headers[key] = '[redacted]';
    } else {
      headers[key] = value;
    }
  });
  console.log('[Cron Auth] Headers:', JSON.stringify(headers, null, 2));
}
