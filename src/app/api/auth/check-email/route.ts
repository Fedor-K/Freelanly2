import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/auth/check-email
 *
 * Checks if a user with the given email already exists.
 * Used to determine whether to show login or registration form.
 */
export async function POST(request: NextRequest) {
  try {
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

    if (existingUser) {
      return NextResponse.json({
        exists: true,
        name: existingUser.name,
        isVerified: !!existingUser.emailVerified,
      });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    console.error('[CheckEmail] Error:', error);
    return NextResponse.json({ error: 'Check failed' }, { status: 500 });
  }
}
