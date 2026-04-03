import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { isCronAuthorized } from '@/lib/cron-auth';

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month') || '2026-03'; // YYYY-MM

  const [year, mon] = month.split('-').map(Number);
  const from = Math.floor(new Date(year, mon - 1, 1).getTime() / 1000);
  const to = Math.floor(new Date(year, mon, 1).getTime() / 1000);

  try {
    // All charges (successful payments)
    const charges: Stripe.Charge[] = [];
    for await (const c of stripe.charges.list({ created: { gte: from, lt: to }, limit: 100 })) {
      charges.push(c);
    }

    const successful = charges.filter(c => c.status === 'succeeded' && !c.refunded);
    const refunded = charges.filter(c => c.refunded);
    const totalRevenue = successful.reduce((s, c) => s + c.amount, 0) / 100;
    const totalRefunded = refunded.reduce((s, c) => s + (c.amount_refunded || 0), 0) / 100;

    // Subscriptions created this month
    const subs: Stripe.Subscription[] = [];
    for await (const s of stripe.subscriptions.list({ created: { gte: from, lt: to }, limit: 100, status: 'all' })) {
      subs.push(s);
    }

    // Subscriptions canceled this month — filter from all canceled subs
    const canceled: Stripe.Subscription[] = [];
    for await (const s of stripe.subscriptions.list({ limit: 100, status: 'canceled' })) {
      if (s.canceled_at && s.canceled_at >= from && s.canceled_at < to) {
        canceled.push(s);
      }
      // Stop paginating if we're past the month
      if (s.created < from - 365 * 24 * 3600) break;
    }

    // Also check for subscriptions that are currently active
    const activeSubs: Stripe.Subscription[] = [];
    for await (const s of stripe.subscriptions.list({ status: 'active', limit: 100 })) {
      activeSubs.push(s);
    }

    // Checkout sessions
    const sessions: Stripe.Checkout.Session[] = [];
    for await (const s of stripe.checkout.sessions.list({ created: { gte: from, lt: to }, limit: 100 })) {
      sessions.push(s);
    }
    const completedSessions = sessions.filter(s => s.status === 'complete');
    const expiredSessions = sessions.filter(s => s.status === 'expired');

    // MRR calculation from active subs
    let mrr = 0;
    for (const s of activeSubs) {
      const item = s.items.data[0];
      if (item?.price?.unit_amount && item?.price?.recurring) {
        const amount = item.price.unit_amount / 100;
        const interval = item.price.recurring.interval;
        const count = item.price.recurring.interval_count || 1;
        if (interval === 'month') mrr += amount / count;
        else if (interval === 'year') mrr += amount / (12 * count);
        else if (interval === 'week') mrr += (amount * 52) / 12 / count;
      }
    }

    // Group by plan
    const byPlan: Record<string, number> = {};
    for (const s of completedSessions) {
      const key = s.metadata?.priceKey || 'unknown';
      byPlan[key] = (byPlan[key] || 0) + 1;
    }

    // Invoices for more detail
    const invoices: Stripe.Invoice[] = [];
    for await (const inv of stripe.invoices.list({ created: { gte: from, lt: to }, limit: 100, status: 'paid' })) {
      invoices.push(inv);
    }

    return NextResponse.json({
      month,
      revenue: {
        gross: totalRevenue,
        refunded: totalRefunded,
        net: totalRevenue - totalRefunded,
        currency: 'EUR',
      },
      subscriptions: {
        newThisMonth: subs.length,
        canceledThisMonth: canceled.length,
        currentlyActive: activeSubs.length,
        netNew: subs.length - canceled.length,
      },
      mrr: Math.round(mrr * 100) / 100,
      checkout: {
        total: sessions.length,
        completed: completedSessions.length,
        expired: expiredSessions.length,
        conversionRate: sessions.length > 0 ? Math.round((completedSessions.length / sessions.length) * 100) : 0,
        byPlan,
      },
      invoices: {
        paid: invoices.length,
        totalPaid: invoices.reduce((s, i) => s + (i.amount_paid || 0), 0) / 100,
      },
      details: {
        charges: successful.map(c => ({
          date: new Date(c.created * 1000).toISOString().split('T')[0],
          amount: c.amount / 100,
          email: c.billing_details?.email || c.receipt_email,
          description: c.description,
        })),
      },
    });
  } catch (error) {
    console.error('[Stripe Report]', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
