import { NextRequest } from 'next/server';

/**
 * Validate cron request - supports multiple auth methods:
 * 1. Authorization: Bearer <CRON_SECRET> header (for external calls, Vercel crons)
 * 2. Vercel internal cron (checks CRON_SECRET from vercel.json)
 * 3. X-Replit-Cron header (for Replit scheduled tasks)
 * 4. Query parameter ?token=<CRON_SECRET> (fallback)
 */
export function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.log('[Cron Auth] CRON_SECRET not set');
    return false;
  }

  // Method 1: Standard Bearer token (for external calls like curl, Vercel crons)
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    console.log('[Cron Auth] Authorized via Bearer token');
    return true;
  }

  // Method 2: Vercel Cron - checks for x-vercel-cron-secret header
  // Set CRON_SECRET in Vercel env vars and it will be passed in this header
  const vercelCronSecret = request.headers.get('x-vercel-cron-secret');
  if (vercelCronSecret === cronSecret) {
    console.log('[Cron Auth] Authorized via Vercel cron secret');
    return true;
  }

  // Method 3: Query parameter (fallback)
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (token === cronSecret) {
    console.log('[Cron Auth] Authorized via query parameter');
    return true;
  }

  // Method 4: Replit internal cron header
  // When Replit runs scheduled tasks, we trust the x-replit-cron header
  const replitCron = request.headers.get('x-replit-cron');
  if (replitCron === 'true') {
    console.log('[Cron Auth] Authorized via x-replit-cron header (internal)');
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
