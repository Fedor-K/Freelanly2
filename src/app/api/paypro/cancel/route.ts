import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PAYPRO_CONFIG } from '@/lib/paypro';

/**
 * POST /api/paypro/cancel
 * Cancel a PayPro subscription for the current user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { payproSubscriptionId: true, payproOrderId: true, paymentProvider: true },
    });

    if (!user || user.paymentProvider !== 'paypro') {
      return NextResponse.json({ error: 'No PayPro subscription found' }, { status: 400 });
    }

    const subscriptionId = user.payproSubscriptionId;
    if (!subscriptionId) {
      return NextResponse.json({ error: 'No subscription ID' }, { status: 400 });
    }

    // Call PayPro API to terminate subscription
    const response = await fetch('https://store.payproglobal.com/api/Subscriptions/Terminate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorAccountId: PAYPRO_CONFIG.vendorAccountId,
        apiSecretKey: PAYPRO_CONFIG.secretKey,
        subscriptionId: parseInt(subscriptionId),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[PayPro Cancel] API error:', error);
      return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 500 });
    }

    // Update user
    await prisma.user.update({
      where: { id: session.user.id },
      data: { plan: 'FREE', payproSubscriptionId: null },
    });

    console.log(`[PayPro Cancel] User ${session.user.id} cancelled subscription ${subscriptionId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PayPro Cancel] Error:', error);
    return NextResponse.json({ error: 'Failed to cancel' }, { status: 500 });
  }
}
