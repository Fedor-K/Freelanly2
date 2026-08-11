import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { constructWebhookEvent } from '@/lib/stripe';
import { revokeApplyCredits } from '@/lib/apply-quota';
import { grantApplyCreditsForPI } from '@/lib/apply-credits';
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

      // Pay-per-apply: card saved at onboarding/wall via SetupIntent → persist for one-tap charges.
      case 'setup_intent.succeeded': {
        const si = event.data.object as Stripe.SetupIntent;
        await handleSetupIntentSucceeded(si);
        break;
      }

      // Pay-per-apply: $3 pack purchase succeeded → grant apply-credits (idempotent).
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await handleApplyCreditsPaid(pi);
        break;
      }

      // Abandoned Go-PRO subscription checkout (hosted session expired unpaid, ~24h). No PaymentIntent
      // is created for these, so they never show as "Incomplete" in Stripe Payments — record them here
      // so we still have the list (they also enter the survey via application_paywall_shown).
      case 'checkout.session.expired': {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.client_reference_id || s.metadata?.userId || undefined;
        const email = s.customer_email || s.customer_details?.email || undefined;
        await prisma.activityLog.create({ data: { action: ActivityAction.FUNNEL_STEP, userId,
          details: { step: 'subscription_checkout_abandoned', session: s.id, email, mode: s.mode } } }).catch(() => {});
        break;
      }

      // Capture the top-up attempts that DON'T convert — the "Incomplete" rows in the Stripe dashboard
      // (created, never confirmed) + hard declines. Recorded so we have an authoritative list of who
      // reached checkout and didn't pay (with decline reason), independent of client-side tracking.
      case 'payment_intent.created': {
        await recordTopupAttempt(event.data.object as Stripe.PaymentIntent, 'created');
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await recordTopupAttempt(pi, 'failed', pi.last_payment_error?.decline_code || pi.last_payment_error?.code || pi.last_payment_error?.message);
        await recordSubChargeFailed(pi);
        break;
      }
      case 'payment_intent.canceled': {
        await recordTopupAttempt(event.data.object as Stripe.PaymentIntent, 'canceled');
        break;
      }

      // Pay-per-apply: a credit-pack charge was refunded or disputed → claw back the granted credits
      // (proportional to the amount clawed; idempotent per PaymentIntent so refund+dispute don't double).
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        await handleCreditsClawback(charge.payment_intent as string | null, charge.amount_refunded, charge.currency);
        break;
      }
      case 'charge.dispute.created': {
        const dispute = event.data.object as Stripe.Dispute;
        await handleCreditsClawback(dispute.payment_intent as string | null, dispute.amount, dispute.currency);
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

  // FIRST payment: the inline Go-PRO flow (no Checkout Session) never fires
  // checkout.session.completed, so this is its only chance to be counted — without it the
  // subscriber exists in Stripe but is invisible to revenue and the payment funnel (two live
  // $5 subs went unrecorded before this landed). Guarded so hosted-checkout subs that were
  // already recorded by handleCheckoutCompleted don't double-count.
  if (invoiceData.billing_reason === 'subscription_create') {
    const already = await prisma.revenueEvent.findFirst({
      where: { type: 'SUBSCRIPTION_STARTED', stripeSubscriptionId: subscriptionId },
      select: { id: true },
    });
    if (!already) {
      await prisma.revenueEvent.create({
        data: {
          type: 'SUBSCRIPTION_STARTED',
          amount: invoiceData.amount_paid,
          currency: invoiceData.currency.toUpperCase(),
          userId: user.id,
          planTo: 'PRO',
          stripeEventId: invoice.id,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscriptionId,
        },
      });
      // Feed the canonical payment funnel (metrics count credit_charge_success ∪ RevenueEvent).
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: ActivityAction.FUNNEL_STEP,
          details: { step: 'credit_charge_success', source: 'invoice_paid', subscriptionId },
        },
      }).catch(() => {});
    }
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

// Pay-per-apply: a card was saved via SetupIntent (onboarding or at the wall). Persist it so the next
// $3 charge is one-tap, and make it the customer's default payment method.
async function handleSetupIntentSucceeded(si: Stripe.SetupIntent) {
  const customerId = (si.customer as string) || null;
  const paymentMethodId = (si.payment_method as string) || null;
  if (!customerId || !paymentMethodId) return;

  const user = await prisma.user.findFirst({ where: { stripeId: customerId } });
  const userId = user?.id || si.metadata?.userId;
  if (!userId) {
    console.error('[Stripe Webhook] setup_intent.succeeded: no user for customer', customerId);
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { stripePaymentMethodId: paymentMethodId, stripeId: customerId },
  }).catch((e) => console.error('[Stripe Webhook] Failed to save payment method:', e));

  try {
    const { getStripe } = await import('@/lib/stripe');
    await getStripe().customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  } catch (e) {
    console.error('[Stripe Webhook] Failed to set default payment method:', e);
  }

  console.log(`[Stripe Webhook] Card saved for user ${userId}`);
}

// Record a top-up PaymentIntent that did NOT convert (created-but-never-confirmed = the "Incomplete"
// dashboard rows, or a hard decline/cancel) into ActivityLog, so we have an authoritative list of who
// reached checkout and didn't pay — with Stripe's decline reason. apply_credits PIs only.
async function recordTopupAttempt(pi: Stripe.PaymentIntent, kind: 'created' | 'failed' | 'canceled', declineReason?: string | null) {
  if (pi.metadata?.type !== 'apply_credits') return; // ignore subscription / other PIs
  const userId = pi.metadata?.userId || undefined;
  await prisma.activityLog.create({
    data: {
      action: ActivityAction.FUNNEL_STEP,
      userId,
      details: {
        step: `topup_${kind}`,
        pi: pi.id,
        amountCents: pi.amount,
        status: pi.status,
        email: pi.receipt_email || undefined,
        declineReason: declineReason || undefined,
      },
    },
  }).catch(() => {});
}

// Server-side record of a FAILED charge that is NOT an apply_credits top-up — i.e. the $5-subscription
// first-invoice PI (inline Go-PRO) or any other charge on a Freelanly customer. These PIs carry no
// metadata (Stripe creates them for the invoice), so we identify ours by customer → User.stripeId;
// Translync shares the Stripe account and its customers won't match, which keeps them out. Without this,
// a card decline on the sub flow only exists client-side (credit_charge_client_error) and is lost
// entirely when the tab dies before the event fires.
async function recordSubChargeFailed(pi: Stripe.PaymentIntent) {
  if (pi.metadata?.type === 'apply_credits') return; // already recorded as topup_failed
  const customerId = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id;
  if (!customerId) return;
  const user = await prisma.user.findFirst({ where: { stripeId: customerId }, select: { id: true, email: true } }).catch(() => null);
  if (!user) return; // not a Freelanly customer (e.g. Translync rides the same Stripe account)
  await prisma.activityLog.create({
    data: {
      action: ActivityAction.FUNNEL_STEP,
      userId: user.id,
      details: {
        step: 'charge_failed_server',
        pi: pi.id,
        amountCents: pi.amount,
        declineCode: pi.last_payment_error?.decline_code || undefined,
        code: pi.last_payment_error?.code || undefined,
        msg: (pi.last_payment_error?.message || '').slice(0, 160) || undefined,
      },
    },
  }).catch(() => {});
}

// Pay-per-apply: a $3 apply-credit pack PaymentIntent succeeded → grant the credits. Idempotent and
// crash-safe: the unique stripeEventId (= PaymentIntent id) is claimed in the SAME transaction as the
// credit increment, so a re-delivered event (Stripe can send an event more than once) rolls back and
// never double-grants. Subscription-invoice PIs have no `apply_credits` metadata and are ignored.
async function handleApplyCreditsPaid(pi: Stripe.PaymentIntent) {
  // Idempotent grant shared with the client-confirm endpoint (either can win the race safely).
  await grantApplyCreditsForPI(pi);
}

// Pay-per-apply: a credit-pack charge was refunded or disputed → revoke the granted credits (clamped at
// 0). Looks up the original grant by the PaymentIntent id (the key used when granting), so only our
// apply_credits purchases are touched. Idempotent via a REFUND RevenueEvent with a unique stripeEventId.
async function handleCreditsClawback(
  paymentIntentId: string | null,
  clawedAmountCents: number | null,
  currency: string | null,
) {
  if (!paymentIntentId) return;

  const grant = await prisma.revenueEvent.findFirst({ where: { stripeEventId: paymentIntentId } });
  const meta = grant?.metadata as { kind?: string; credits?: number } | null;
  if (!grant) {
    // Out-of-order delivery: a refund/dispute can arrive before the grant's payment_intent.succeeded was
    // recorded. If this PI IS one of our credit packs, throw so Stripe retries later (grant will be
    // committed by then); otherwise it's a subscription/other refund → ignore.
    try {
      const { getStripe } = await import('@/lib/stripe');
      const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
      if (pi.metadata?.type === 'apply_credits') {
        throw new Error(`RETRY: apply_credits grant not yet recorded for ${paymentIntentId}`);
      }
    } catch (e) {
      if ((e as Error)?.message?.startsWith('RETRY:')) throw e;
      // retrieve failed for another reason — don't block the webhook, just ignore this event
    }
    return;
  }
  if (meta?.kind !== 'apply_credits') return; // grant exists but isn't a credit pack

  const grantedCredits = Number(meta?.credits || 0);
  const originalAmount = grant.amount || 0;
  const userId = grant.userId;
  if (!userId || !(grantedCredits > 0)) return;

  // Revoke PROPORTIONALLY to the amount clawed back — a $1 refund of a $3/6-credit pack revokes 2, not
  // all 6. A dispute contests the full charge → full revoke. Clamp to what was granted.
  const clawed = clawedAmountCents ?? originalAmount;
  const toRevoke = originalAmount > 0
    ? Math.min(grantedCredits, Math.ceil((grantedCredits * clawed) / originalAmount))
    : grantedCredits;
  if (!(toRevoke > 0)) return;

  // Idempotent PER PURCHASE (keyed by the PaymentIntent), so a refund AND a dispute on the SAME charge
  // revoke once, and a re-delivered event is a no-op. (Edge: two separate PARTIAL refunds of the same
  // tiny charge under-revoke — accepted as vanishingly rare for a $3 pack.)
  try {
    await prisma.revenueEvent.create({
      data: {
        type: 'REFUND',
        amount: clawed,
        currency: (currency || 'usd').toUpperCase(),
        userId,
        stripeEventId: `revoke_${paymentIntentId}`,
        metadata: { kind: 'apply_credits_revoke', revoked: toRevoke, ofGranted: grantedCredits, originalPaymentIntent: paymentIntentId },
      },
    });
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') {
      console.log(`[Stripe Webhook] credits clawback already processed for PI ${paymentIntentId}`);
      return;
    }
    throw e;
  }

  await revokeApplyCredits(userId, toRevoke);
  console.log(`[Stripe Webhook] Revoked ${toRevoke}/${grantedCredits} apply-credits from user ${userId} (PI ${paymentIntentId})`);
}
