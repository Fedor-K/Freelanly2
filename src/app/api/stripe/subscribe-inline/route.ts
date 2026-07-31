import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStripe, STRIPE_PRICES } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import type Stripe from 'stripe';

/**
 * Inline Go-PRO ($5/mo) — mirror of the top-up flow but for the subscription, so it renders in our own
 * modal (no redirect to Stripe's hosted page). Creates the subscription with payment_behavior
 * 'default_incomplete', so:
 *   - abandoned attempts show as "Incomplete" in Stripe (Subscriptions + the first-invoice PaymentIntent),
 *   - the client confirms the first invoice's PaymentIntent inline (Payment Element / saved card),
 *   - conversion is better than bouncing the user to a hosted page.
 * The existing customer.subscription.created/updated webhook upgrades the user to PRO on payment.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, plan: true, stripeId: true, stripePaymentMethodId: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (user.plan !== 'FREE') return NextResponse.json({ error: 'already_pro' }, { status: 400 });

    const stripe = getStripe();

    let customerId = user.stripeId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email || undefined, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeId: customerId } }).catch(() => {});
    }

    const savedPm = user.stripePaymentMethodId || undefined;

    const sub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: STRIPE_PRICES.pro5 }],
      payment_behavior: 'default_incomplete',
      ...(savedPm ? { default_payment_method: savedPm } : {}),
      payment_settings: { save_default_payment_method: 'on_subscription', payment_method_types: ['card'] },
      expand: ['latest_invoice.payment_intent'],
      metadata: { userId: user.id, type: 'pro5_inline' },
    });

    const invoice = sub.latest_invoice as Stripe.Invoice | null;
    const pi = (invoice as unknown as { payment_intent?: Stripe.PaymentIntent })?.payment_intent;
    if (!pi?.client_secret) {
      // No PI (e.g. $0 first invoice) — nothing to confirm; shouldn't happen for pro5 (no trial, $5).
      return NextResponse.json({ error: 'no_payment_intent' }, { status: 500 });
    }

    return NextResponse.json({ clientSecret: pi.client_secret, hasCard: !!savedPm, subscriptionId: sub.id });
  } catch (error) {
    console.error('[Subscribe Inline] Error:', error);
    return NextResponse.json({ error: 'Failed to start subscription' }, { status: 500 });
  }
}
