import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user to check for Stripe subscription
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        stripeId: true,
        stripeSubscriptionId: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Cancel Stripe subscription if exists
    if (user.stripeSubscriptionId) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        console.log(`[DeleteAccount] Cancelled Stripe subscription for ${user.email}`);
      } catch (stripeError) {
        console.error('[DeleteAccount] Failed to cancel Stripe subscription:', stripeError);
        // Continue with deletion anyway
      }
    }

    // Delete user (cascades to related data due to onDelete: Cascade in schema)
    // This will delete:
    // - Accounts (OAuth)
    // - Sessions
    // - Applications
    // - JobAlerts
    // - ApplyAttempts
    // - CookieConsents
    await prisma.user.delete({
      where: { id: userId },
    });

    console.log(`[DeleteAccount] Deleted user ${user.email}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DeleteAccount] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
