import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { setRecruiterSession } from '@/lib/recruiter-session';
import { hashCode } from '../send-otp/route';

// POST /api/recruiter/verify-otp — verify the 6-digit code and start a session (httpOnly cookie).
// On success the recruiter is registered (upsert) and can visit /recruiter to land in their portal.
const MAX_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Enter the 6-digit code' }, { status: 400 });
    }

    const otp = await prisma.recruiterOtp.findUnique({ where: { email } });
    if (!otp || otp.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Code expired — request a new one' }, { status: 400 });
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return NextResponse.json({ error: 'Too many attempts — request a new code' }, { status: 429 });
    }
    if (otp.codeHash !== hashCode(code)) {
      await prisma.recruiterOtp.update({ where: { email }, data: { attempts: { increment: 1 } } }).catch(() => {});
      return NextResponse.json({ error: 'Incorrect code' }, { status: 400 });
    }

    // Success — consume the code, register the recruiter, set the session cookie.
    await prisma.recruiterOtp.delete({ where: { email } }).catch(() => {});
    await prisma.recruiter.upsert({
      where: { email },
      create: { email, lastSeenAt: new Date() },
      update: { lastSeenAt: new Date() },
    }).catch(() => {});
    await setRecruiterSession(email);

    const h = request.headers;
    await prisma.activityLog.create({
      data: {
        action: 'RECRUITER_PORTAL_ACTION',
        details: { recruiterEmail: email, event: 'otp_login' },
        ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: h.get('user-agent') || null,
      },
    }).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
