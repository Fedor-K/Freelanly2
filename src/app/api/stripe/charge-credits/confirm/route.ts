import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { grantApplyCreditsForPI } from '@/lib/apply-credits';
import { CREDITS_ENABLED } from '@/lib/apply-quota';

/**
 * POST /api/stripe/charge-credits/confirm  { paymentIntentId }
 * Called by the client right after Stripe.js confirms the pack payment, so the credits are on the
 * balance the instant the apply retries — no waiting on webhook delivery. Idempotent (shared grant),
 * so this and the payment_intent.succeeded webhook can both run without double-granting.
 */
export async function POST(request: NextRequest) {
  try {
    if (!CREDITS_ENABLED) return NextResponse.json({ error: 'disabled' }, { status: 403 });

    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { paymentIntentId } = await request.json().catch(() => ({}));
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return NextResponse.json({ error: 'paymentIntentId required' }, { status: 400 });
    }

    const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
    // Ownership: a user may only confirm their OWN apply_credits intent.
    if (pi.metadata?.type !== 'apply_credits' || pi.metadata?.userId !== session.user.id) {
      return NextResponse.json({ error: 'not_your_intent' }, { status: 403 });
    }
    if (pi.status !== 'succeeded') {
      return NextResponse.json({ ok: false, status: pi.status }, { status: 202 });
    }

    await grantApplyCreditsForPI(pi); // idempotent — 0 if the webhook already granted

    const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { applyCredits: true } });
    return NextResponse.json({ ok: true, applyCredits: u?.applyCredits ?? 0 });
  } catch (error) {
    console.error('[Confirm Credits] Error:', error);
    return NextResponse.json({ error: 'Failed to confirm' }, { status: 500 });
  }
}
