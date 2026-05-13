import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PLAN_LIMITS, PLAN_FEATURES, PRICE_INFO } from '@/lib/stripe';

// GET /api/user/billing — usage, plan details, limits
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        plan: true,
        appsUsedThisCycle: true,
        cycleStartedAt: true,
        subscriptionEndsAt: true,
        stripeId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const planKey = user.plan as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[planKey] || PLAN_LIMITS.FREE;

    // Calculate days until cycle reset
    const cycleStart = user.cycleStartedAt || new Date();
    const nextReset = new Date(cycleStart);
    nextReset.setMonth(nextReset.getMonth() + 1);
    const daysUntilReset = Math.max(0, Math.ceil((nextReset.getTime() - Date.now()) / 86400000));

    // Count templates
    const templateCount = await prisma.coverLetterTemplate.count({
      where: { userId: session.user.id },
    });

    // Count inboxes (SMTP connections)
    const inboxCount = await prisma.userSmtp.count({
      where: { userId: session.user.id },
    });

    return NextResponse.json({
      plan: user.plan,
      usage: {
        applications: { used: user.appsUsedThisCycle, limit: limits.appsPerMonth, unlimited: limits.appsPerMonth === -1 },
        templates: { used: templateCount, limit: limits.templates, unlimited: limits.templates === -1 },
        inboxes: { used: inboxCount + 1, limit: limits.inboxes }, // +1 for Postal default
      },
      cycle: {
        startedAt: cycleStart,
        resetsIn: daysUntilReset,
        nextReset,
      },
      limits,
      features: PLAN_FEATURES[planKey === 'AGENCY' ? 'agency' : planKey === 'PRO' ? 'pro' : 'free'],
      plans: Object.entries(PRICE_INFO).map(([key, info]) => ({
        key,
        ...info,
        limits: PLAN_LIMITS[info.plan] || PLAN_LIMITS.PRO,
        features: PLAN_FEATURES[info.plan === 'AGENCY' ? 'agency' : 'pro'],
      })),
      subscription: {
        endsAt: user.subscriptionEndsAt,
        stripeId: user.stripeId,
        hasSubscription: !!user.stripeSubscriptionId,
      },
    });
  } catch (error) {
    console.error('[Billing] GET error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
