import { NextRequest, NextResponse } from 'next/server';
import { randomUUID, randomInt } from 'crypto';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/postal';
import { rateLimit, sanitizeEmail } from '@/lib/rate-limit';
import { checkPartnerSecret, sanitizeBrand } from '../_lib/partner';

/**
 * POST /api/partner/otp — send a watcher-branded 6-digit sign-in code.
 * Body: { email, brand: { name, domain } }
 * Same VerificationToken storage the main OTP flow uses, so /api/partner/verify
 * (and nothing else) can redeem it.
 */
export async function POST(request: NextRequest) {
  if (!checkPartnerSecret(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await request.json();
    const email = sanitizeEmail(String(body.email || ''));
    const brand = sanitizeBrand(body.brand);
    if (!email || !email.includes('@') || !brand) {
      return NextResponse.json({ error: 'email and brand required' }, { status: 400 });
    }

    // Per-email rate limit — partner traffic shares one IP, so limit by identifier only.
    const lim = rateLimit('partner_otp', email, 5, 15 * 60_000);
    if (lim.limited) {
      return NextResponse.json({ error: 'Too many codes requested. Try again later.' }, { status: 429 });
    }

    const code = String(randomInt(100000, 1000000));
    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token: randomUUID(),
        code,
        expires: new Date(Date.now() + 15 * 60_000),
      },
    });

    const subject = `${code} — your ${brand.name} sign-in code`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#F4F7FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14202F">
  <div style="max-width:440px;margin:0 auto;padding:40px 24px">
    <div style="font-size:17px;font-weight:600;margin-bottom:18px">${brand.name}</div>
    <div style="background:#fff;border:1px solid #D5DFEE;border-radius:14px;padding:28px;text-align:center">
      <div style="font-size:14px;color:#5D7191;margin-bottom:14px">Your sign-in code</div>
      <div style="font-family:ui-monospace,monospace;font-size:34px;font-weight:700;letter-spacing:0.35em;padding-left:0.35em">${code}</div>
      <div style="font-size:12.5px;color:#8494AE;margin-top:14px">Expires in 15 minutes. If you didn't request this, ignore this email.</div>
    </div>
    <div style="font-size:11.5px;color:#8494AE;margin-top:18px;text-align:center">© 2026 ${brand.name} · an IntentPond product</div>
  </div>
</body></html>`;
    const text = `Your ${brand.name} sign-in code: ${code}\n\nExpires in 15 minutes. If you didn't request this, ignore this email.`;

    const sent = await sendEmail({ to: email, subject, html, text, fromName: brand.name, from: `alerts@${brand.domain}` });
    if (!sent.success) {
      return NextResponse.json({ error: 'send_failed', message: sent.error }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'internal', message: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
