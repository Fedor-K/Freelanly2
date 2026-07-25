import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, sanitizeEmail } from '@/lib/rate-limit';
import { signRegToken } from '@/lib/reg-token';
import { checkPartnerSecret, sanitizeBrand } from '../_lib/partner';

/**
 * POST /api/partner/verify — redeem a 6-digit code, create the account if new.
 * Body: { email, code }
 * Returns { userId, regToken, hasResume, plan }. The watcher app sets its OWN
 * session cookie on its own domain; regToken additionally authorizes the
 * pre-auth résumé upload route (same proof the main signup flow uses).
 */
export async function POST(request: NextRequest) {
  if (!checkPartnerSecret(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await request.json();
    const email = sanitizeEmail(String(body.email || ''));
    const code = String(body.code || '').trim();
    const brand = sanitizeBrand(body.brand);

    const lim = rateLimit('partner_verify', email, 8, 15 * 60_000);
    if (lim.limited) {
      return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
    }
    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Invalid email or code format' }, { status: 400 });
    }

    const token = await prisma.verificationToken.findFirst({
      where: {
        identifier: { equals: email, mode: 'insensitive' },
        code,
        expires: { gt: new Date() },
      },
    });
    if (!token) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
    }
    // Single-use: burn every outstanding code for this identifier.
    await prisma.verificationToken.deleteMany({ where: { identifier: { equals: email, mode: 'insensitive' } } }).catch(() => {});

    // Watcher accounts are stamped at creation (source = watcher:{domain}) so every
    // engine consumer — Freelanly-branded email crons, cleanup, analytics — can tell the
    // two products apart. Existing Freelanly accounts are never re-stamped.
    const user = await prisma.user.upsert({
      where: { email },
      update: { emailVerified: new Date() },
      create: { email, emailVerified: new Date(), source: brand ? `watcher:${brand.domain}` : 'watcher:unknown' },
      select: { id: true, email: true, plan: true, resumeUrl: true, name: true, stripeSubscriptionId: true },
    });

    return NextResponse.json({
      userId: user.id,
      regToken: signRegToken(email),
      hasResume: !!user.resumeUrl,
      plan: user.plan,
      name: user.name,
      hasSubscription: !!user.stripeSubscriptionId,
    });
  } catch (e) {
    return NextResponse.json({ error: 'internal', message: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
