import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PAYPRO_CONFIG } from '@/lib/paypro';

/**
 * POST /api/paypro/retention
 * Apply retention offers for PayPro subscribers: discount or pause.
 * Body: { offerType: 'discount' | 'pause' }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { offerType } = await request.json();
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { payproSubscriptionId: true, paymentProvider: true },
    });

    if (!user || user.paymentProvider !== 'paypro' || !user.payproSubscriptionId) {
      return NextResponse.json({ error: 'No PayPro subscription found' }, { status: 400 });
    }

    const subscriptionId = parseInt(user.payproSubscriptionId);

    if (offerType === 'discount') {
      // Apply 50% discount by changing recurring price
      // Current price €15 → €7.50 (or €10 for simplicity)
      const response = await fetch('https://store.payproglobal.com/api/Subscriptions/ChangeRecurringPrice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorAccountId: PAYPRO_CONFIG.vendorAccountId,
          apiSecretKey: PAYPRO_CONFIG.secretKey,
          subscriptionId,
          newPrice: 7.50,
          currencyCode: 'EUR',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[PayPro Retention] Discount API error:', error);
        return NextResponse.json({ error: 'Failed to apply discount' }, { status: 500 });
      }

      console.log(`[PayPro Retention] Applied 50% discount for user ${session.user.id}`);
      return NextResponse.json({ success: true, offer: 'discount' });

    } else if (offerType === 'pause') {
      // Suspend subscription for 1 month
      const response = await fetch('https://store.payproglobal.com/api/Subscriptions/Suspend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorAccountId: PAYPRO_CONFIG.vendorAccountId,
          apiSecretKey: PAYPRO_CONFIG.secretKey,
          subscriptionId,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[PayPro Retention] Pause API error:', error);
        return NextResponse.json({ error: 'Failed to pause subscription' }, { status: 500 });
      }

      console.log(`[PayPro Retention] Paused subscription for user ${session.user.id}`);
      return NextResponse.json({ success: true, offer: 'pause' });
    }

    return NextResponse.json({ error: 'Invalid offer type' }, { status: 400 });
  } catch (error) {
    console.error('[PayPro Retention] Error:', error);
    return NextResponse.json({ error: 'Failed to process offer' }, { status: 500 });
  }
}
