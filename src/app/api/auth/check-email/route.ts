import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp, sanitizeEmail } from '@/lib/rate-limit';

/**
 * POST /api/auth/check-email
 *
 * Checks if a user with the given email already exists.
 * Used to determine whether to show login or registration form.
 *
 * Security: rate limited + constant timing delay to prevent enumeration.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    const limit = rateLimit('check_email', ip, 5, 60_000);
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
      );
    }

    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }

    const normalizedEmail = sanitizeEmail(email);

    // Add constant delay to prevent timing-based enumeration
    const start = Date.now();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        emailVerified: true,
      },
    });

    // Pad response time to constant ~200ms to prevent timing attacks
    const elapsed = Date.now() - start;
    if (elapsed < 200) {
      await new Promise(r => setTimeout(r, 200 - elapsed));
    }

    // Return minimal info — no name, no details. Just exists + verified.
    return NextResponse.json({
      exists: !!existingUser,
      isVerified: !!existingUser?.emailVerified,
    });
  } catch (error) {
    console.error('[CheckEmail] Error:', error);
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}
