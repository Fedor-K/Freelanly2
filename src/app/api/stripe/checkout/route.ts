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

    // Build URLs. NEXT_PUBLIC_APP_URL is NOT set on Vercel prod — the old localhost fallback made
    // Stripe bounce paying users to http://localhost:3000 after checkout. Fall back to the real domain.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? 'https://freelanly.com' : 'http://localhost:3000');
    // /jobs pages were removed in the pivot — land upgrades on the dashboard (where the queue lives).
    const successUrl = `${baseUrl}/dashboard?subscription=success&welcome=1`;
    const cancelUrl = `${baseUrl}/dashboard?subscription=cancelled`;

    // Fetch user to get gclid for Google Ads attribution
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { gclid: true },
    });

    // Read conversion UTM from cookie
    const convUtmCookie = request.cookies.get('conv_utm')?.value;
    let conversionSource: string | undefined;
    let conversionMedium: string | undefined;
    let conversionCampaign: string | undefined;
    if (convUtmCookie) {
      const decoded = decodeURIComponent(convUtmCookie);
      for (const part of decoded.split('|')) {
        const [key, ...rest] = part.split(':');
        const val = rest.join(':');
        if (key === 'source' && val) conversionSource = val;
        if (key === 'medium' && val) conversionMedium = val;
        if (key === 'campaign' && val) conversionCampaign = val;
      }
    }

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
      conversionSource,
      conversionMedium,
      conversionCampaign,
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
