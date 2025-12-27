import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { constructWebhookEvent } from '@/lib/stripe';

// Disable body parsing - we need raw body for signature verification
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature');

    if (!signature) {
      console.error('[Stripe Webhook] Missing signature');
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = constructWebhookEvent(body, signature);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await handleInvoicePaid(invoice);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Handle successful checkout
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.client_reference_id || session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    console.error('[Stripe Webhook] No userId in checkout session');
    return;
  }

  console.log(`[Stripe Webhook] Checkout completed for user ${userId}, subscription ${subscriptionId}`);

  // Fetch subscription to get period end date
  let subscriptionEndsAt: Date | null = null;
  if (subscriptionId) {
    try {
      const { getStripe } = await import('@/lib/stripe');
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      // Access current_period_end (exists on Subscription object)
      const periodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end;
      if (periodEnd) {
        subscriptionEndsAt = new Date(periodEnd * 1000);
        console.log(`[Stripe Webhook] Subscription ends at: ${subscriptionEndsAt.toISOString()}`);
      }
    } catch (err) {
      console.error('[Stripe Webhook] Error fetching subscription:', err);
    }
  }

  // Update user with Stripe IDs and subscription end date
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan: 'PRO',
      subscriptionEndsAt,
    },
  });

  console.log(`[Stripe Webhook] User ${userId} upgraded to PRO`);

  // Record revenue event
  await prisma.revenueEvent.create({
    data: {
      type: 'SUBSCRIPTION_STARTED',
      amount: session.amount_total || 0,
      currency: session.currency?.toUpperCase() || 'EUR',
      userId,
      planTo: 'PRO',
      stripeEventId: session.id,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
    },
  });
}

// Handle subscription updates
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  // Access current_period_end from subscription (it's on the base Subscription type)
  const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { stripeId: customerId },
  });

  if (!user) {
    // Try to find by metadata
    const userId = subscription.metadata?.userId;
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeId: customerId,
          stripeSubscriptionId: subscriptionId,
          plan: subscription.status === 'active' || subscription.status === 'trialing' ? 'PRO' : 'FREE',
          subscriptionEndsAt: periodEnd ? new Date(periodEnd * 1000) : null,
        },
      });
    }
    return;
  }

  console.log(`[Stripe Webhook] Subscription updated for user ${user.id}: ${subscription.status}`);

  // Update user subscription status
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscriptionId,
      plan: isActive ? 'PRO' : 'FREE',
      subscriptionEndsAt: periodEnd ? new Date(periodEnd * 1000) : null,
    },
  });
}

// Handle subscription deletion/cancellation
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeId: customerId },
  });

  if (!user) {
    console.error('[Stripe Webhook] No user found for customer:', customerId);
    return;
  }

  console.log(`[Stripe Webhook] Subscription deleted for user ${user.id}`);

  // Downgrade to FREE
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      subscriptionEndsAt: null,
    },
  });

  // Record churn event
  await prisma.revenueEvent.create({
    data: {
      type: 'SUBSCRIPTION_CHURNED',
      amount: 0,
      currency: 'EUR',
      userId: user.id,
      planFrom: 'PRO',
      planTo: 'FREE',
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
    },
  });
}

// Handle successful payment
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  // Access subscription which may be string or null
  const invoiceData = invoice as unknown as { subscription: string | null; amount_paid: number; currency: string; billing_reason: string };
  const subscriptionId = invoiceData.subscription;

  if (!subscriptionId) return; // Not a subscription invoice

  const user = await prisma.user.findFirst({
    where: { stripeId: customerId },
  });

  if (!user) return;

  console.log(`[Stripe Webhook] Invoice paid for user ${user.id}: ${invoiceData.amount_paid} cents`);

  // Ensure user is on PRO plan
  if (user.plan !== 'PRO') {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'PRO' },
    });
  }

  // Record renewal if not first payment
  if (invoiceData.billing_reason === 'subscription_cycle') {
    await prisma.revenueEvent.create({
      data: {
        type: 'SUBSCRIPTION_RENEWED',
        amount: invoiceData.amount_paid,
        currency: invoiceData.currency.toUpperCase(),
        userId: user.id,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      },
    });
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeId: customerId },
  });

  if (!user) return;

  console.log(`[Stripe Webhook] Payment failed for user ${user.id}`);

  // TODO: Send email notification about failed payment
  // For now, Stripe will retry automatically
}
