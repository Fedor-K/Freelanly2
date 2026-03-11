import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createCheckoutSession, STRIPE_PRICES, type PriceKey } from '@/lib/stripe';
import { alertCheckoutError } from '@/lib/telegram-alerts';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  let userEmail: string | undefined;

  try {
    // Check authentication
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      );
    }

    userEmail = session.user.email;

    // Parse request body
    const body = await request.json();
    const { priceKey, source, jobId, opportunityId, coupon } = body as {
      priceKey?: string;
      source?: string;
      jobId?: string;
      opportunityId?: string;
      coupon?: string;
    };

    // Map promo code strings to Stripe promotion_code IDs
    const PROMO_CODE_IDS: Record<string, string> = {
      QUICK15: 'promo_1SlvdHKHJU6KLxM34HzwoOyb',
      COMEBACK20: 'promo_1SdzJQKHJU6KLxM3NuHLP61B',
      DANGRMUSA: 'promo_1SqXNrKHJU6KLxM3C9tqaibo',
    };
    const promotionCodeId = coupon ? PROMO_CODE_IDS[coupon.toUpperCase()] : undefined;

    // Validate price key
    if (!priceKey || !Object.keys(STRIPE_PRICES).includes(priceKey)) {
      return NextResponse.json(
        { error: 'Invalid price key. Use: monthly, quarterly, or annual' },
        { status: 400 }
      );
    }

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const successUrl = `${baseUrl}/jobs?subscription=success&welcome=1`;
    const cancelUrl = `${baseUrl}/pricing?subscription=cancelled`;

    // Fetch user to get gclid for Google Ads attribution
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { gclid: true },
    });

    // Create Stripe Checkout session with source tracking
    const checkoutSession = await createCheckoutSession({
      userId: session.user.id,
      userEmail: session.user.email,
      priceKey: priceKey as PriceKey,
      successUrl,
      cancelUrl,
      source,
      jobId,
      opportunityId,
      gclid: user?.gclid || undefined,
      promotionCodeId,
    });

    // Save checkout session to DB for abandoned cart tracking
    await prisma.checkoutSession.create({
      data: {
        stripeSessionId: checkoutSession.id,
        email: session.user.email,
        userId: session.user.id,
        priceKey: priceKey as string,
        amount: checkoutSession.amount_total,
        source,
        jobId,
        opportunityId,
      },
    });

    return NextResponse.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);

    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && 'type' in error ? (error as { type?: string }).type : undefined;

    // Send alert to Telegram
    alertCheckoutError(errorMessage, userEmail).catch(() => {});

    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: errorMessage,
        type: errorDetails,
      },
      { status: 500 }
    );
  }
}
