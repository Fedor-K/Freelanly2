import { prisma } from '@/lib/db';

/**
 * Database-backed rate limiter for Vercel serverless.
 * Uses ActivityLog table to count recent requests — works across all instances.
 *
 * For non-critical endpoints, falls back to in-memory (best-effort).
 */

/**
 * DB-based rate limit: counts recent ActivityLog entries for an action + IP.
 * Returns { limited: false } or { limited: true }.
 */
export async function rateLimitByDb(
  action: string,
  ip: string,
  maxRequests: number,
  windowMs: number
): Promise<{ limited: boolean }> {
  const since = new Date(Date.now() - windowMs);

  const count = await prisma.activityLog.count({
    where: {
      action,
      ipAddress: ip,
      createdAt: { gte: since },
    },
  });

  return { limited: count >= maxRequests };
}

// --- In-memory rate limiter (best-effort, for non-critical paths) ---

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

function getStore(name: string): Map<string, RateLimitEntry> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

export function rateLimit(
  storeName: string,
  key: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; retryAfter?: number } {
  const store = getStore(storeName);
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false };
  }

  if (entry.count >= maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { limited: true, retryAfter };
  }

  entry.count++;
  return { limited: false };
}

/**
 * Extract client IP from request headers.
 */
export function getClientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Sanitize string: strip HTML tags and control characters.
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/[\r\n\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // strip control chars including \r\n
    .trim();
}

/**
 * Sanitize email: normalize and strip injection characters.
 */
export function sanitizeEmail(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .replace(/[\r\n\x00-\x08\x0B\x0C\x0E-\x1F]/g, ''); // strip CRLF and control chars
}
