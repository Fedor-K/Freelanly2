/**
 * Simple in-memory rate limiter for API routes.
 * Works per-instance (resets on cold start) — good enough for Vercel serverless.
 */

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

/**
 * Check if a key is rate limited.
 * Returns { limited: false } or { limited: true, retryAfter: seconds }.
 */
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
