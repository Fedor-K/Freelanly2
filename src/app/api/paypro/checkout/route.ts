import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildCheckoutUrl, PAYPRO_PRODUCTS, type PayProPriceKey } from '@/lib/paypro';

/**
 * POST /api/paypro/checkout
 *
 * Creates a PayPro checkout URL and returns it.
 * Body: { priceKey: 'monthly' | 'quarterly' | 'annual' }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { priceKey } = await request.json() as { priceKey: PayProPriceKey };

    if (!priceKey || !PAYPRO_PRODUCTS[priceKey]) {
      return NextResponse.json({ error: 'Invalid price key' }, { status: 400 });
    }

    const productId = PAYPRO_PRODUCTS[priceKey];
    if (!productId) {
      return NextResponse.json(
        { error: 'PayPro product not configured. Please use Stripe checkout.' },
        { status: 400 }
      );
    }

    // Build checkout URL with test mode in non-production
    const url = buildCheckoutUrl({
      productId,
      userId: session.user.id,
      email: session.user.email,
      testMode: process.env.PAYPRO_TEST_MODE === 'true',
    });

    console.log(`[PayPro Checkout] priceKey=${priceKey}, productId=${productId}, url=${url}`);
    return NextResponse.json({ url });
  } catch (error) {
    console.error('[PayPro Checkout] Error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
