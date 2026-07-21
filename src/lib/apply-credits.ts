import Stripe from 'stripe';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

/**
 * Grant apply-credits from a SUCCEEDED apply_credits PaymentIntent.
 *
 * Idempotent + crash-safe: the unique stripeEventId (= PaymentIntent id) is claimed in the SAME
 * transaction as the credit increment, so a re-delivered webhook event AND a client-confirm racing the
 * webhook can both call this without ever double-granting. Shared by the webhook (payment_intent.succeeded)
 * and the client-confirm endpoint (so the buyer has credits the instant their apply retries, without
 * waiting on webhook delivery).
 *
 * @returns credits granted this call (0 if already granted, not an apply_credits PI, or not succeeded).
 */
export async function grantApplyCreditsForPI(pi: Stripe.PaymentIntent): Promise<number> {
  if (pi.metadata?.type !== 'apply_credits') return 0;
  if (pi.status !== 'succeeded') return 0; // never grant on an unconfirmed/failed intent
  const userId = pi.metadata.userId;
  const credits = Number(pi.metadata.credits || 0);
  if (!userId || !(credits > 0)) return 0;

  const pmId = (pi.payment_method as string) || null;
  const customerId = (pi.customer as string) || null;

  try {
    await prisma.$transaction([
      prisma.revenueEvent.create({
        data: {
          type: 'ONE_TIME_PAYMENT',
          amount: pi.amount_received || pi.amount || 0,
          currency: (pi.currency || 'usd').toUpperCase(),
          userId,
          stripeEventId: pi.id,
          stripeCustomerId: customerId || undefined,
          metadata: { kind: 'apply_credits', credits },
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          applyCredits: { increment: credits },
          // fresh-card path: setup_future_usage saved the PM on this PI — persist it for next time.
          ...(pmId ? { stripePaymentMethodId: pmId } : {}),
          ...(customerId ? { stripeId: customerId } : {}),
        },
      }),
    ]);
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return 0; // already granted (idempotent)
    throw e;
  }

  await prisma.activityLog.create({
    data: { userId, action: ActivityAction.CHECKOUT_COMPLETE, details: { type: 'apply_credits', credits, amount: (pi.amount || 0) / 100 } },
  }).catch(() => {});

  console.log(`[apply-credits] Granted ${credits} to user ${userId} (PI ${pi.id})`);
  return credits;
}
