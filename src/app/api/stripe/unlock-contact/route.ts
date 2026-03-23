import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { siteConfig } from '@/config/site';

const SINGLE_CONTACT_PRICE_ID = 'price_1TE1IgKHJU6KLxM3IFsYfYtE';

/**
 * POST /api/stripe/unlock-contact
 * Creates a Stripe Checkout session for a single contact unlock (€3).
 * Body: { jobId?: string, opportunityId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { jobId, opportunityId } = await request.json();
    if (!jobId && !opportunityId) {
      return NextResponse.json({ error: 'jobId or opportunityId required' }, { status: 400 });
    }

    const stripe = getStripe();
    const itemId = jobId || opportunityId;
    const itemType = jobId ? 'job' : 'opportunity';

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment', // one-time, not subscription
      customer_email: session.user.email,
      client_reference_id: session.user.id,
      line_items: [
        {
          price: SINGLE_CONTACT_PRICE_ID,
          quantity: 1,
        },
      ],
      metadata: {
        userId: session.user.id,
        itemId,
        itemType,
        type: 'unlock_contact',
        source: 'upgrade_modal',
        priceKey: 'single_contact',
      },
      success_url: `${siteConfig.url}/dashboard?payment=success&unlock=${itemType}`,
      cancel_url: `${siteConfig.url}/${itemType === 'job' ? 'jobs' : 'freelance'}`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[Unlock Contact] Error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
