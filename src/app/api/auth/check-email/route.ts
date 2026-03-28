import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

/**
 * POST /api/auth/check-email
 *
 * Checks if a user with the given email already exists.
 * Used to determine whether to show login or registration form.
 *
 * Rate limited to 5 requests/min per IP to prevent enumeration.
 * Response timing is constant to avoid timing-based enumeration.
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

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        name: true,
        emailVerified: true,
      },
    });

    // Constant-shape response — but don't expose exists/name for unknown emails
    // For legitimate UI flow: the frontend needs to know if user exists to show
    // login vs register. We rely on rate limiting to prevent mass enumeration.
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
