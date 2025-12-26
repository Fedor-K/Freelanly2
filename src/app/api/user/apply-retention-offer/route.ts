import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

interface RetentionOfferRequest {
  offerType: 'discount' | 'pause';
}

/**
 * Apply retention offer to prevent churn
 * POST /api/user/apply-retention-offer
 *
 * Options:
 * - discount: 50% off next billing cycle
 * - pause: Pause subscription for 1 month
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RetentionOfferRequest = await request.json();
    const { offerType } = body;

    if (!offerType || !['discount', 'pause'].includes(offerType)) {
      return NextResponse.json({ error: 'Invalid offer type' }, { status: 400 });
    }

    // Get user with subscription info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        stripeSubscriptionId: true,
        stripeId: true,
        plan: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.stripeSubscriptionId) {
      return NextResponse.json({ error: 'No active subscription' }, { status: 400 });
    }

    const stripe = getStripe();

    if (offerType === 'discount') {
      // Apply 50% discount coupon for next billing cycle
      // First, check if we have a retention coupon, or create one
      let couponId = 'retention_50_off';

      try {
        await stripe.coupons.retrieve(couponId);
      } catch {
        // Coupon doesn't exist, create it
        await stripe.coupons.create({
          id: couponId,
          percent_off: 50,
          duration: 'once',
          name: 'Retention - 50% Off',
        });
      }

      // Apply coupon to subscription using discounts
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        discounts: [{
          coupon: couponId,
        }],
      });

      // Record the offer
      await prisma.retentionOffer.create({
        data: {
          userId: user.id,
          email: user.email,
          offerType: 'DISCOUNT_50',
          stripeSubscriptionId: user.stripeSubscriptionId,
        },
      });

      console.log(`[RetentionOffer] Applied 50% discount to subscription ${user.stripeSubscriptionId} for ${user.email}`);

      return NextResponse.json({
        success: true,
        message: '50% discount applied to your next billing cycle',
        offerType: 'discount',
      });
    } else if (offerType === 'pause') {
      // Pause subscription for 1 month
      // Calculate resume date (1 month from now)
      const resumeDate = new Date();
      resumeDate.setMonth(resumeDate.getMonth() + 1);

      // Pause the subscription
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        pause_collection: {
          behavior: 'void', // Don't charge during pause
          resumes_at: Math.floor(resumeDate.getTime() / 1000),
        },
      });

      // Record the offer
      await prisma.retentionOffer.create({
        data: {
          userId: user.id,
          email: user.email,
          offerType: 'PAUSE_1_MONTH',
          stripeSubscriptionId: user.stripeSubscriptionId,
        },
      });

      console.log(`[RetentionOffer] Paused subscription ${user.stripeSubscriptionId} for ${user.email} until ${resumeDate.toISOString()}`);

      return NextResponse.json({
        success: true,
        message: 'Subscription paused for 1 month',
        offerType: 'pause',
        resumeDate: resumeDate.toISOString(),
      });
    }

    return NextResponse.json({ error: 'Unknown offer type' }, { status: 400 });
  } catch (error) {
    console.error('[RetentionOffer] Error:', error);
    return NextResponse.json(
      { error: 'Failed to apply offer', details: String(error) },
      { status: 500 }
    );
  }
}
