import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';

const UNLOCK_PRICE_CENTS = 500; // $5 per reply unlock (Fedor 2026-06-13)

/**
 * POST /api/stripe/unlock-reply
 * One-time $5 Stripe Checkout to unlock a single recruiter reply (read full text + respond).
 * The candidate's FIRST reply is unlocked for free at inbound time; this is for the rest.
 * Body: { applicationId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { applicationId } = await request.json();
    if (!applicationId) {
      return NextResponse.json({ error: 'applicationId required' }, { status: 400 });
    }

    // The app must belong to this user and actually have a reply to unlock.
    const app = await prisma.autoApplication.findFirst({
      where: { id: applicationId, userId: session.user.id },
      select: { id: true, replyUnlocked: true, repliedAt: true, companyName: true },
    });
    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!app.repliedAt) return NextResponse.json({ error: 'No reply to unlock' }, { status: 400 });
    if (app.replyUnlocked) {
      return NextResponse.json({ error: 'already_unlocked', alreadyUnlocked: true }, { status: 409 });
    }

    const stripe = getStripe();
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: session.user.email,
      client_reference_id: session.user.id,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Unlock recruiter reply',
              description: `Read & respond to ${app.companyName}'s reply`,
            },
            unit_amount: UNLOCK_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: session.user.id,
        applicationId: app.id,
        type: 'unlock_reply',
        priceCents: String(UNLOCK_PRICE_CENTS),
      },
      success_url: `${siteConfig.url}/dashboard/inbox?unlocked=${app.id}`,
      cancel_url: `${siteConfig.url}/dashboard/inbox`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('[Unlock Reply] Error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
