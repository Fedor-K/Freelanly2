import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { CREDITS_ENABLED } from '@/lib/apply-quota';

/**
 * POST /api/stripe/setup-intent
 * Create a SetupIntent so the client can save a card via inline Stripe Elements (NO charge, NO redirect).
 * Used by the optional "add card now" step at onboarding — the saved card makes the first $3 pack
 * one-tap at the wall. The card is persisted by the `setup_intent.succeeded` webhook.
 */
export async function POST(_request: NextRequest) {
  try {
    if (!CREDITS_ENABLED) {
      return NextResponse.json({ error: 'disabled' }, { status: 403 });
    }

    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, stripeId: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const stripe = getStripe();

    // Ensure a Stripe Customer exists (lazy — only created when a user actually opts to add a card).
    let customerId = user.stripeId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: user.id }, data: { stripeId: customerId } }).catch(() => {});
    }

    const si = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
      metadata: { userId: user.id },
    });

    return NextResponse.json({ clientSecret: si.client_secret });
  } catch (error) {
    console.error('[Setup Intent] Error:', error);
    return NextResponse.json({ error: 'Failed to create setup intent' }, { status: 500 });
  }
}
