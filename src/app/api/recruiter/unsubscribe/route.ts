import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';

/**
 * Recruiter one-click unsubscribe (List-Unsubscribe / RFC 8058).
 * - POST: the provider's one-click call (body "List-Unsubscribe=One-Click"). Suppress, return 200.
 * - GET:  a human clicked the link. Suppress, render a small confirmation page.
 *
 * The signed token (?t=) encodes the recruiter email. Suppression is honored in the auto-apply
 * send loop (RecruiterSuppression), so we stop ALL future outreach to this address.
 */
async function suppress(token: string | null): Promise<string | null> {
  const email = verifyRecruiterToken(token || '');
  if (!email) return null;
  const lower = email.toLowerCase().trim();
  // Fail soft — never 500 a provider's one-click call over a missing table / transient error.
  await prisma.recruiterSuppression
    .upsert({ where: { email: lower }, create: { email: lower, reason: 'optout' }, update: {} })
    .catch((e) => console.warn('[RecruiterUnsubscribe] not recorded (migration pending?):', e?.message));
  return lower;
}

export async function POST(request: NextRequest) {
  await suppress(request.nextUrl.searchParams.get('t'));
  // RFC 8058: always 200 so the mailbox provider marks the one-click handled.
  return new NextResponse(null, { status: 200 });
}

export async function GET(request: NextRequest) {
  const email = await suppress(request.nextUrl.searchParams.get('t'));
  const msg = email
    ? `You're unsubscribed. We won't send any more candidate applications to <strong>${email}</strong>.`
    : `This unsubscribe link is invalid or expired.`;
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribe · Freelanly</title></head>
    <body style="font-family:system-ui,sans-serif;background:#FAF9F6;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px">
      <div style="max-width:440px;background:#fff;border:1px solid #E8E5DC;border-radius:14px;padding:32px;text-align:center">
        <div style="font-size:22px;font-weight:700;margin-bottom:8px">Freelanly</div>
        <p style="color:#444;font-size:15px;line-height:1.6;margin:0">${msg}</p>
      </div>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}
