import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { CREDITS_ENABLED, CREDIT_PACK_PRICE_CENTS } from '@/lib/apply-quota';

/**
 * POST /api/stripe/charge-credits
 * Buy one pay-per-apply pack ($3 → 6 apply credits) with an ON-SESSION PaymentIntent — no redirect.
 *
 * Server creates the PaymentIntent (unconfirmed) and returns its client_secret; the CLIENT confirms it
 * with Stripe.js, which handles 3DS/SCA natively (critical for Indian cards). Credits are granted by the
 * `payment_intent.succeeded` webhook (idempotent). `setup_future_usage` saves the card so the NEXT pack
 * is one-tap.
 *
 * Two flows:
 *  - saved card (`hasCard:true`): PI is created with the stored payment method attached — the client just
 *    calls stripe.confirmCardPayment(clientSecret).
 *  - fresh card (`hasCard:false`): the client mounts a PaymentElement and calls stripe.confirmPayment.
 */
// Allowed top-up amounts in cents (balance model, min $3). Whitelisted SERVER-SIDE so a tampered client
// can never buy balance below price ($0.50/apply — credits derive strictly from the whitelisted amount).
const TOPUP_AMOUNTS = [300, 500, 1000];
const PER_APPLY_CENTS = 50;

export async function POST(request: NextRequest) {
  try {
    if (!CREDITS_ENABLED) {
      return NextResponse.json({ error: 'disabled' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const amountCents = TOPUP_AMOUNTS.includes(Number(body?.amountCents)) ? Number(body.amountCents) : CREDIT_PACK_PRICE_CENTS;
    const credits = Math.floor(amountCents / PER_APPLY_CENTS);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, stripeId: true, stripePaymentMethodId: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stripe = getStripe();

    // Ensure a Stripe Customer exists (created lazily — most registrations never reach here).
    let customerId = user.stripeId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeId: customerId } }).catch(() => {});
    }

    const savedPm = user.stripePaymentMethodId;
    const metadata = { type: 'apply_credits', userId: user.id, credits: String(credits) };

    const pi = await stripe.paymentIntents.create(
      savedPm
        ? {
            amount: amountCents,
            currency: 'usd',
            customer: customerId,
            payment_method: savedPm,
            payment_method_types: ['card'],
            setup_future_usage: 'off_session',
            metadata,
          }
        : {
            amount: amountCents,
            currency: 'usd',
            customer: customerId,
            automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
            setup_future_usage: 'off_session',
            metadata,
          }
    );

    return NextResponse.json({
      clientSecret: pi.client_secret,
      hasCard: !!savedPm,
      packSize: credits,
      amountCents,
    });
  } catch (error) {
    console.error('[Charge Credits] Error:', error);
    return NextResponse.json({ error: 'Failed to start charge' }, { status: 500 });
  }
}
