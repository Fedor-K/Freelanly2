import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { CancellationReason } from '@prisma/client';

interface CancelRequest {
  reason: CancellationReason;
  otherText?: string;
  feedback?: string;
}

/**
 * Cancel subscription with feedback survey
 * POST /api/user/cancel-subscription
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CancelRequest = await request.json();
    const { reason, otherText, feedback } = body;

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    // Get user with subscription info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        stripeSubscriptionId: true,
        plan: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    // Determine plan type from Stripe subscription
    let planAtCancellation = 'unknown';
    try {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
      const priceId = subscription.items.data[0]?.price?.id;

      if (priceId?.includes('weekly') || subscription.items.data[0]?.price?.recurring?.interval === 'week') {
        planAtCancellation = 'weekly';
      } else if (priceId?.includes('annual') || subscription.items.data[0]?.price?.recurring?.interval === 'year') {
        planAtCancellation = 'annual';
      } else {
        planAtCancellation = 'monthly';
      }
    } catch (e) {
      console.error('[CancelSubscription] Error getting plan type:', e);
    }

    // Save cancellation feedback
    await prisma.cancellationFeedback.create({
      data: {
        userId: user.id,
        reason,
        otherText: reason === 'OTHER' ? otherText : null,
        feedback,
        planAtCancellation,
        subscriptionId: user.stripeSubscriptionId,
      },
    });

    // Cancel subscription at period end (user keeps access until end of billing period)
    try {
      const stripe = getStripe();
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      console.log(`[CancelSubscription] Subscription ${user.stripeSubscriptionId} set to cancel at period end for ${user.email}`);
      console.log(`[CancelSubscription] Reason: ${reason}${otherText ? ` - ${otherText}` : ''}`);

      return NextResponse.json({
        success: true,
        message: 'Subscription will be canceled at the end of your billing period',
      });
    } catch (stripeError) {
      console.error('[CancelSubscription] Stripe error:', stripeError);
      return NextResponse.json(
        { error: 'Failed to cancel subscription' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[CancelSubscription] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process cancellation' },
      { status: 500 }
    );
  }
}

/**
 * Get cancellation reasons (for form)
 * GET /api/user/cancel-subscription
 */
export async function GET() {
  const reasons = [
    { value: 'TOO_EXPENSIVE', label: 'Too expensive', emoji: '💰' },
    { value: 'NOT_ENOUGH_JOBS', label: 'Not enough relevant jobs', emoji: '📋' },
    { value: 'FOUND_JOB', label: 'I found a job!', emoji: '🎉' },
    { value: 'NOT_USING', label: "Not using it enough", emoji: '⏰' },
    { value: 'MISSING_FEATURES', label: 'Missing features I need', emoji: '🔧' },
    { value: 'TECHNICAL_ISSUES', label: 'Technical problems', emoji: '🐛' },
    { value: 'POOR_JOB_QUALITY', label: "Jobs don't match my skills", emoji: '🎯' },
    { value: 'OTHER', label: 'Other reason', emoji: '💬' },
  ];

  return NextResponse.json({ reasons });
}
