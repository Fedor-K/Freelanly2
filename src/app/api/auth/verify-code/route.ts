import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { rateLimit, getClientIp, sanitizeEmail } from '@/lib/rate-limit';
import { signRegToken } from '@/lib/reg-token';

/**
 * POST /api/auth/verify-code
 *
 * Verifies 6-digit OTP code and creates a session (same as magic link click).
 * Body: { email: string, code: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 attempts per 15 minutes per IP (prevents brute force)
    const ip = getClientIp(request.headers);
    const ipLimit = rateLimit('verify_ip', ip, 5, 15 * 60_000);
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter) } }
      );
    }

    const { email, code, timezone, flow } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: 'Email and code are required' },
        { status: 400 }
      );
    }

    // Rate limit by email too: 5 attempts per 15 minutes
    const emailLimit = rateLimit('verify_email', email.toLowerCase().trim(), 5, 15 * 60_000);
    if (emailLimit.limited) {
      return NextResponse.json(
        { error: 'Too many attempts for this email. Please request a new code.' },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfter) } }
      );
    }

    const normalizedEmail = sanitizeEmail(email);
    const normalizedCode = code.trim();

    // Validate code format
    if (!/^\d{6}$/.test(normalizedCode)) {
      return NextResponse.json(
        { error: 'Invalid code format. Please enter the 6-digit code.' },
        { status: 400 }
      );
    }

    // Find the verification token with this code (case-insensitive to handle
    // normalization differences between NextAuth and our sanitizeEmail())
    const token = await prisma.verificationToken.findFirst({
      where: {
        identifier: { equals: normalizedEmail, mode: 'insensitive' },
        code: normalizedCode,
        expires: { gt: new Date() },
      },
    });

    if (!token) {
      return NextResponse.json(
        { error: 'Invalid or expired code. Please request a new one.' },
        { status: 400 }
      );
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Mark email as verified + save timezone
    const updateData: Record<string, unknown> = {};
    if (!user.emailVerified) updateData.emailVerified = new Date();
    if (timezone && typeof timezone === 'string' && timezone.includes('/')) updateData.timezone = timezone;
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: updateData });
    }

    // Delete the used verification token (OTP is single-use regardless of what happens next).
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: token.identifier, token: token.token } },
    });

    // DEFER THE SESSION for the registration flow of a résumé-less user: the OTP is confirmed, but the
    // account isn't "registered" until the résumé + required fields are saved. resume-preauth creates
    // the session once the profile is complete (carrying the signed regToken below as proof of this
    // OTP). Everyone with a résumé (returning login) — and any flow that doesn't ask to defer — gets
    // the session right here, exactly as before. FAIL-SAFE: if the deferral can't issue a token we fall
    // through and create the session, so registration is never blocked.
    let regToken: string | null = null;
    if (flow === 'register' && !user.resumeUrl) {
      try { regToken = signRegToken(normalizedEmail); } catch { regToken = null; }
    }
    if (regToken) {
      return NextResponse.json({ success: true, needsProfile: true, regToken });
    }

    // Create a session (same as NextAuth would do after magic link click)
    const sessionToken = randomUUID();
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await prisma.session.create({ data: { sessionToken, userId: user.id, expires: sessionExpiry } });

    // Set the session cookie (same name NextAuth uses)
    const cookieStore = await cookies();
    const isSecure = process.env.NODE_ENV === 'production';
    const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
    cookieStore.set(cookieName, sessionToken, {
      expires: sessionExpiry, httpOnly: true, secure: isSecure, sameSite: 'lax', path: '/',
    });

    // Log login activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        details: { email: normalizedEmail, provider: 'otp_code' },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
        country: request.headers.get('x-vercel-ip-country') || null,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      callbackUrl: '/dashboard/discovery',
    });
  } catch (error) {
    console.error('[VerifyCode] Error:', error);
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
