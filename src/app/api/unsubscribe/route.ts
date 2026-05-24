import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createHmac } from 'crypto';
import { ActivityAction } from '@prisma/client';

const SECRET = process.env.AUTH_SECRET || 'fallback-secret';

/**
 * Generate unsubscribe token for email
 */
export function generateUnsubscribeToken(email: string): string {
  return createHmac('sha256', SECRET)
    .update(email.toLowerCase())
    .digest('hex')
    .substring(0, 32);
}

/**
 * Verify unsubscribe token
 */
export function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expectedToken = generateUnsubscribeToken(email);
  return token === expectedToken;
}

/**
 * POST /api/unsubscribe
 * Unsubscribe user from marketing emails
 */
export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Verify token if provided (for security)
    if (token && !verifyUnsubscribeToken(email, token)) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists, just return success
      return NextResponse.json({ success: true, message: 'If this email exists, it has been unsubscribed.' });
    }

    // Update user preferences
    await prisma.user.update({
      where: { id: user.id },
      data: {
        unsubscribedFromMarketing: true,
        unsubscribedAt: new Date(),
      },
    });

    // Also deactivate all job alerts for this user
    await prisma.jobAlert.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    console.log(`[Unsubscribe] User ${email} unsubscribed from marketing emails`);

    // Track unsubscribe
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: ActivityAction.UNSUBSCRIBE,
        details: { email, source: 'api' },
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'You have been unsubscribed from marketing emails.',
    });
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/unsubscribe?email=xxx&token=xxx
 * Unsubscribe via link click (redirects to confirmation page)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  const token = searchParams.get('token');

  if (!email) {
    return NextResponse.redirect(new URL('/unsubscribe?error=missing_email', request.url));
  }

  // Email-link unsubscribe always carries a token — require a valid one
  // (prevents unsubscribing arbitrary emails via a token-less link).
  if (!token || !verifyUnsubscribeToken(email, token)) {
    return NextResponse.redirect(new URL('/unsubscribe?error=invalid_token', request.url));
  }

  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user) {
      // Update user preferences
      await prisma.user.update({
        where: { id: user.id },
        data: {
          unsubscribedFromMarketing: true,
          unsubscribedAt: new Date(),
        },
      });

      // Also deactivate all job alerts
      await prisma.jobAlert.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      });

      console.log(`[Unsubscribe] User ${email} unsubscribed via link`);

      // Track unsubscribe
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: ActivityAction.UNSUBSCRIBE,
          details: { email, source: 'email_link' },
        },
      }).catch(() => {});
    }

    // Redirect to success page
    return NextResponse.redirect(new URL('/unsubscribe?success=true', request.url));
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.redirect(new URL('/unsubscribe?error=failed', request.url));
  }
}
