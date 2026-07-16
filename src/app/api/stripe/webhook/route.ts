import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { constructWebhookEvent } from '@/lib/stripe';
import { sendActivationEmail } from '@/services/activation-emails';
import { uploadOfflineConversion } from '@/lib/google-ads';
import { ActivityAction } from '@prisma/client';

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

  // Handle single contact unlock (one-time payment)
  if (session.metadata?.type === 'unlock_contact') {
    const itemId = session.metadata.itemId;
    const itemType = session.metadata.itemType;

    const data: Record<string, unknown> = {
      userId,
      stripeSessionId: session.id,
      amount: session.amount_total || 300,
      currency: session.currency?.toUpperCase() || 'EUR',
    };
    if (itemType === 'job') data.jobId = itemId;
    else data.opportunityId = itemId;

    await prisma.unlockedContact.create({ data: data as Parameters<typeof prisma.unlockedContact.create>[0]['data'] });

    await prisma.activityLog.create({
      data: {
        userId,
        action: ActivityAction.CHECKOUT_COMPLETE,
        details: { type: 'unlock_contact', itemType, itemId, amount: (session.amount_total || 0) / 100 },
      },
    }).catch(() => {});

    console.log(`[Stripe Webhook] Contact unlocked for user ${userId}: ${itemType} ${itemId}`);
    return;
  }

  // Handle single reply unlock ($5 one-time payment — read+respond to a recruiter reply)
  if (session.metadata?.type === 'unlock_reply') {
    const applicationId = session.metadata.applicationId;
    if (applicationId) {
      await prisma.autoApplication.updateMany({
        where: { id: applicationId, userId },
        data: { replyUnlocked: true },
      });
      await prisma.activityLog.create({
        data: {
          userId,
          action: ActivityAction.CHECKOUT_COMPLETE,
          details: { type: 'unlock_reply', applicationId, amount: (session.amount_total || 0) / 100 },
        },
      }).catch(() => {});
      console.log(`[Stripe Webhook] Reply unlocked for user ${userId}: app ${applicationId}`);
    }
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

  // Build conversion UTM data (only on first purchase)
  const conversionData: Record<string, unknown> = {};
  if (session.metadata?.conversionSource) {
    // Only set conversionAt if not already set (first purchase only)
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { conversionAt: true },
    });
    if (!existingUser?.conversionAt) {
      conversionData.conversionSource = session.metadata.conversionSource;
      conversionData.conversionMedium = session.metadata.conversionMedium || null;
      conversionData.conversionCampaign = session.metadata.conversionCampaign || null;
      conversionData.conversionAt = new Date();
    }
  }

  // Update user with Stripe IDs and subscription end date
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeId: customerId,
      stripeSubscriptionId: subscriptionId,
      plan: 'PRO',
      paymentProvider: 'stripe',
      subscriptionEndsAt,
      ...conversionData,
    },
  });

  console.log(`[Stripe Webhook] User ${userId} upgraded to PRO`);

  // Track checkout complete in activity log
  await prisma.activityLog.create({
    data: {
      userId,
      action: ActivityAction.CHECKOUT_COMPLETE,
      details: {
        subscriptionId,
        source: session.metadata?.source || 'unknown',
        amount: session.amount_total ? session.amount_total / 100 : undefined,
        currency: session.currency,
      },
    },
  }).catch((e) => console.error('[Stripe Webhook] Failed to log CHECKOUT_COMPLETE:', e));

  // Mark all ApplyAttempts as converted (for conversion analytics)
  try {
    const updated = await prisma.applyAttempt.updateMany({
      where: {
        userId,
        converted: false,
      },
      data: {
        converted: true,
        convertedAt: new Date(),
      },
    });
    if (updated.count > 0) {
      console.log(`[Stripe Webhook] Marked ${updated.count} ApplyAttempts as converted for user ${userId}`);
    }
  } catch (e) {
    console.error('[Stripe Webhook] Failed to update ApplyAttempts:', e);
  }

  // Mark CheckoutSession as completed (for abandoned cart tracking)
  try {
    await prisma.checkoutSession.update({
      where: { stripeSessionId: session.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    console.log(`[Stripe Webhook] Marked CheckoutSession ${session.id} as completed`);
  } catch {
    // Session might not exist if created before this feature was added
    console.log(`[Stripe Webhook] CheckoutSession not found for ${session.id} (may be legacy)`);
  }

  // Log subscription start for dispute evidence
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action: ActivityAction.SUBSCRIPTION_STARTED,
        details: {
          customerId,
          subscriptionId,
          amount: session.amount_total,
          currency: session.currency,
        },
      },
    });
  } catch (e) {
    console.error('[Stripe Webhook] Failed to log subscription start:', e);
  }

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

  // Upload offline conversion to Google Ads (non-blocking)
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { gclid: true },
    });

    if (user?.gclid) {
      const amountInCurrency = (session.amount_total || 0) / 100;
      uploadOfflineConversion({
        gclid: user.gclid,
        conversionValue: amountInCurrency,
        currencyCode: (session.currency || 'eur').toUpperCase(),
        orderId: session.id,
      }).catch((err) => {
        console.error('[Stripe Webhook] Offline conversion upload failed:', err);
      });
      console.log(`[Stripe Webhook] Offline conversion queued for user ${userId}, gclid=${user.gclid}`);
    }
  } catch (e) {
    console.error('[Stripe Webhook] Error reading gclid for offline conversion:', e);
  }

  // Send welcome activation email with personalized job picks
  try {
    const result = await sendActivationEmail(userId, 'WELCOME');
    if (result.success) {
      console.log(`[Stripe Webhook] Welcome activation email sent to user ${userId}`);
    } else {
      console.error(`[Stripe Webhook] Failed to send welcome email: ${result.error}`);
    }
  } catch (err) {
    console.error('[Stripe Webhook] Error sending welcome email:', err);
  }
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

  // Log subscription cancellation for dispute evidence
  try {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: ActivityAction.SUBSCRIPTION_CANCELLED,
        details: {
          customerId,
          subscriptionId: subscription.id,
          reason: subscription.cancellation_details?.reason || 'unknown',
        },
      },
    });
  } catch (e) {
    console.error('[Stripe Webhook] Failed to log subscription cancel:', e);
  }

  // Downgrade to FREE
  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: 'FREE',
      stripeSubscriptionId: null,
      subscriptionEndsAt: null,
    },
  });

  // Pause all auto-apply loops (PRO-only feature)
  await prisma.autoApplyLoop.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false },
  }).catch(() => {});

  await prisma.activityLog.create({
    data: { userId: user.id, action: 'LOOP_PAUSED', details: { source: 'stripe_downgrade' } },
  }).catch(() => {});

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

  // Log payment success for dispute evidence
  try {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: ActivityAction.PAYMENT_SUCCESS,
        details: {
          amount: invoiceData.amount_paid,
          currency: invoiceData.currency,
          subscriptionId,
        },
      },
    });
  } catch (e) {
    console.error('[Stripe Webhook] Failed to log payment success:', e);
  }

  // Ensure user is on PRO plan
  if (user.plan !== 'PRO') {
    await prisma.user.update({
      where: { id: user.id },
      data: { plan: 'PRO', paymentProvider: 'stripe' },
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

  // Log payment failure for dispute evidence
  try {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: ActivityAction.PAYMENT_FAILED,
        details: {
          customerId,
          invoiceId: invoice.id,
        },
      },
    });
  } catch (e) {
    console.error('[Stripe Webhook] Failed to log payment failure:', e);
  }

  // TODO: Send email notification about failed payment
  // For now, Stripe will retry automatically
}
