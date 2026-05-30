import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomInt } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';

// POST /api/recruiter/send-otp — recruiter enters email; we email a 6-digit code.
// Passwordless login, mirroring the candidate OTP flow. Only emails that ACTUALLY received an
// application (or already registered) get a code, so this can't email-bomb strangers. Response is
// always generic — never reveals whether an email is a known recruiter. DB-rate-limited per email.
const MAX_PER_HOUR = 5;
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.toLowerCase().trim() : '';
    if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
    }

    const known =
      (await prisma.autoApplication.findFirst({ where: { appliedToEmail: { equals: email, mode: 'insensitive' } }, select: { id: true } })) ||
      (await prisma.recruiter.findUnique({ where: { email }, select: { id: true } }));

    if (known) {
      // Per-email hourly rate limit (serverless-safe, DB-based).
      const recent = await prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n FROM "ActivityLog"
        WHERE action = 'RECRUITER_PORTAL_ACTION'
          AND details->>'event' = 'otp_sent'
          AND details->>'recruiterEmail' = ${email}
          AND "createdAt" > now() - interval '1 hour'`;
      if (Number(recent[0]?.n || 0) < MAX_PER_HOUR) {
        const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        await prisma.recruiterOtp.upsert({
          where: { email },
          create: { email, codeHash: hashCode(code), expiresAt, attempts: 0 },
          update: { codeHash: hashCode(code), expiresAt, attempts: 0 },
        });

        await sendEmail({
          to: email,
          subject: `${code} is your Freelanly login code`,
          html: `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#0B0C0F">
  <h2 style="font-size:18px;margin:0 0 8px">Your login code</h2>
  <p style="font-size:14px;color:#555;line-height:1.55;margin:0 0 16px">Enter this code to open your candidate inbox:</p>
  <div style="font-size:32px;font-weight:700;letter-spacing:6px;background:#F4F8E8;border:1px solid #C7F94A;border-radius:10px;padding:16px;text-align:center">${code}</div>
  <p style="font-size:12.5px;color:#8A8780;margin:20px 0 0">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
</div>`,
          text: `Your Freelanly login code is ${code}. It expires in 10 minutes.`,
        });

        const h = request.headers;
        await prisma.activityLog.create({
          data: {
            action: 'RECRUITER_PORTAL_ACTION',
            details: { recruiterEmail: email, event: 'otp_sent' },
            ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            userAgent: h.get('user-agent') || null,
          },
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true }); // generic regardless of whether email is known
  } catch {
    return NextResponse.json({ ok: true });
  }
}
