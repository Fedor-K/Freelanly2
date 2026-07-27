import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/postal';
import { checkPartnerSecret, sanitizeBrand } from '../_lib/partner';
import { prisma } from '@/lib/db';
import { createPortalSession } from '@/lib/stripe';

/**
 * POST /api/partner/billing-portal — email the subscriber a Stripe Billing Portal
 * link (manage / cancel their watcher subscription). The watcher app is passwordless
 * (email+OTP), so we mail the short-lived portal URL to the verified address rather
 * than redirecting in-page. Body: { userId, brand: {name, domain} }.
 */
export async function POST(request: NextRequest) {
  if (!checkPartnerSecret(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const body = await request.json();
    const brand = sanitizeBrand(body.brand);
    const userId = typeof body.userId === 'string' ? body.userId.slice(0, 40) : '';
    if (!brand || !userId) return NextResponse.json({ error: 'userId, brand required' }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, stripeId: true } });
    if (!user?.email) return NextResponse.json({ error: 'user not found' }, { status: 404 });
    if (!user.stripeId) return NextResponse.json({ error: 'no_billing', message: 'No billing account yet' }, { status: 400 });

    const portal = await createPortalSession({ customerId: user.stripeId, returnUrl: `https://${brand.domain}/app` });
    const url = portal.url;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;background:#F4F7FC;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#14202F">
  <div style="max-width:520px;margin:0 auto;padding:34px 20px">
    <div style="font-size:16px;font-weight:600;margin-bottom:6px">${brand.name}</div>
    <p style="font-size:15px;line-height:1.55;color:#3a3f47">Here's your secure link to manage your ${brand.name} subscription — update your card, view invoices or cancel anytime.</p>
    <div style="text-align:center;margin:22px 0">
      <a href="${url}" style="display:inline-block;background:#14202F;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 26px;border-radius:10px">Manage subscription &rarr;</a>
    </div>
    <p style="font-size:12px;color:#8494AE">This link is personal and expires shortly. If you didn't request it, you can ignore this email.</p>
  </div>
</body></html>`;
    const text = `Manage your ${brand.name} subscription (update card / cancel):\n${url}\n\nThis link expires shortly.`;

    const sent = await sendEmail({ to: user.email, subject: `Manage your ${brand.name} subscription`, html, text, fromName: brand.name, from: `billing@${brand.domain}` });
    if (!sent.success) return NextResponse.json({ error: 'send_failed', message: sent.error }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'internal', message: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
