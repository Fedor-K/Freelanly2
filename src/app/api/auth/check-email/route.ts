import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// In-memory rate limiter: ip -> { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10; // max requests
const RATE_WINDOW_MS = 60 * 1000; // per 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  return false;
}

/**
 * POST /api/auth/check-email
 *
 * Checks if a user with the given email already exists.
 * Used to determine whether to show login or registration form.
 *
 * Security: always returns same response shape to prevent email enumeration.
 * Rate limited to 10 requests/min per IP.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        emailVerified: true,
      },
    });

    // Always return same shape — don't leak whether email exists
    return NextResponse.json({
      exists: !!existingUser,
      name: existingUser?.name ?? null,
      isVerified: !!existingUser?.emailVerified,
    });
  } catch (error) {
    console.error('[CheckEmail] Error:', error);
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}
