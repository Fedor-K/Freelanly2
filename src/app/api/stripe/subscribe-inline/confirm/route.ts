import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import type Stripe from 'stripe';

/**
 * Called by the modal the instant the inline Go-PRO payment confirms, BEFORE it retries the apply.
 * The subscription→PRO flip normally rides the customer.subscription.updated webhook, which is async —
 * so without this the just-paid user could hit the paywall again on the retry (plan still FREE). This
 * sets plan=PRO synchronously (idempotent with the webhook) once Stripe confirms the sub is paid/active.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { subscriptionId } = await req.json();
    if (!subscriptionId || typeof subscriptionId !== 'string') {
      return NextResponse.json({ error: 'subscriptionId required' }, { status: 400 });
    }

    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['latest_invoice'] });

    // Only upgrade OUR user's own subscription.
    if (sub.metadata?.userId && sub.metadata.userId !== session.user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const invoice = sub.latest_invoice as Stripe.Invoice | null;
    const paid = sub.status === 'active' || sub.status === 'trialing' || invoice?.status === 'paid';
    if (!paid) {
      // Payment not settled yet — the webhook will flip it when it lands. Don't block.
      return NextResponse.json({ pro: false, status: sub.status });
    }

    const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        plan: 'PRO',
        stripeId: (sub.customer as string) || undefined,
        stripeSubscriptionId: sub.id,
        subscriptionEndsAt: periodEnd ? new Date(periodEnd * 1000) : null,
      },
    }).catch(() => {});

    return NextResponse.json({ pro: true });
  } catch (error) {
    console.error('[Subscribe Inline Confirm] Error:', error);
    // Don't hard-fail the client flow — the webhook is the backstop.
    return NextResponse.json({ pro: false, error: 'confirm_failed' });
  }
}
