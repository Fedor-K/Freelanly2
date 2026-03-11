import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

/**
 * Check admin access for browser-facing API routes.
 * Returns null if authorized, or a 401/403 NextResponse if not.
 */
export async function checkAdminSession(
  request: NextRequest
): Promise<NextResponse | null> {
  // Also allow CRON_SECRET for server-to-server calls
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return null; // authorized
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return null; // authorized
}

/**
 * Check cron-only routes (no browser session fallback).
 */
export function checkCronSecret(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
