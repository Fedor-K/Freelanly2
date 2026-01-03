import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * Get conversion funnel stats from Stripe and database
 * GET /api/admin/conversion-stats
 */
export async function GET() {
  try {
    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 24 * 60 * 60;
    const monthAgo = now - 30 * 24 * 60 * 60;

    // Fetch checkout sessions from Stripe
    const [sessionsWeek, sessionsMonth] = await Promise.all([
      stripe.checkout.sessions.list({ created: { gte: weekAgo }, limit: 100 }),
      stripe.checkout.sessions.list({ created: { gte: monthAgo }, limit: 100 }),
    ]);

    // Analyze sessions
    const analyzeSession = (sessions: Stripe.Checkout.Session[]) => {
      const total = sessions.length;
      const completed = sessions.filter(s => s.status === 'complete').length;
      const expired = sessions.filter(s => s.status === 'expired').length;
      const open = sessions.filter(s => s.status === 'open').length;
      const conversionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Group by price
      const byPrice: Record<string, { total: number; completed: number }> = {};
      sessions.forEach(s => {
        const priceKey = s.metadata?.priceKey || 'unknown';
        if (!byPrice[priceKey]) byPrice[priceKey] = { total: 0, completed: 0 };
        byPrice[priceKey].total++;
        if (s.status === 'complete') byPrice[priceKey].completed++;
      });

      return { total, completed, expired, open, conversionRate, byPrice };
    };

    const weekStats = analyzeSession(sessionsWeek.data);
    const monthStats = analyzeSession(sessionsMonth.data);

    // Get recent sessions for the table
    const recentSessions = sessionsMonth.data.slice(0, 20).map(s => ({
      id: s.id.slice(-8),
      date: new Date(s.created * 1000).toISOString(),
      email: s.customer_email || 'N/A',
      status: s.status,
      amount: s.amount_total ? `€${s.amount_total / 100}` : 'Trial',
      priceKey: s.metadata?.priceKey || 'unknown',
    }));

    // Get user registration stats from database
    const weekAgoDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const monthAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [usersWeek, usersMonth, totalPro, totalFree] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: weekAgoDate } } }),
      prisma.user.count({ where: { createdAt: { gte: monthAgoDate } } }),
      prisma.user.count({ where: { plan: 'PRO' } }),
      prisma.user.count({ where: { plan: 'FREE' } }),
    ]);

    // Get revenue events
    const revenueEvents = await prisma.revenueEvent.findMany({
      where: { createdAt: { gte: monthAgoDate } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const subscriptionsStarted = revenueEvents.filter(e => e.type === 'SUBSCRIPTION_STARTED').length;
    const subscriptionsChurned = revenueEvents.filter(e => e.type === 'SUBSCRIPTION_CHURNED').length;

    // Calculate funnel
    const funnel = {
      visitorsToCheckout: monthStats.total > 0 ? `${monthStats.total} sessions` : '0',
      checkoutToComplete: `${monthStats.conversionRate}%`,
      registeredThisMonth: usersMonth,
      registeredThisWeek: usersWeek,
    };

    return NextResponse.json({
      week: weekStats,
      month: monthStats,
      recentSessions,
      users: {
        pro: totalPro,
        free: totalFree,
        newThisWeek: usersWeek,
        newThisMonth: usersMonth,
      },
      revenue: {
        started: subscriptionsStarted,
        churned: subscriptionsChurned,
        net: subscriptionsStarted - subscriptionsChurned,
      },
      funnel,
      revenueEvents: revenueEvents.slice(0, 10).map(e => ({
        date: e.createdAt.toISOString(),
        type: e.type,
        amount: e.amount,
        currency: e.currency,
      })),
    });
  } catch (error) {
    console.error('[Conversion Stats] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
