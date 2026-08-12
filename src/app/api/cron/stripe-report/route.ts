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

  // ?split=1 — per-price cohort view. This Stripe account is SHARED with another product (Translync,
  // €20/mo), so every account-wide number — including the dashboard's churn rate and LTV — blends two
  // businesses with different prices and currencies. Freelanly's subscription is a single price
  // (STRIPE_PRICES.pro5, $5/mo), so grouping by price id is what separates them. Churn here is
  // cancellations in the window over the base active at the window's start, per price.
  if (searchParams.get('split') === '1') {
    const days = Number(searchParams.get('days') || 30);
    const now = Math.floor(Date.now() / 1000);
    const since = now - days * 24 * 3600;

    const all: Stripe.Subscription[] = [];
    for await (const s of stripe.subscriptions.list({ status: 'all', limit: 100 })) all.push(s);

    const rows: Record<string, {
      price: string; product: string; currency: string; unitAmount: number; interval: string;
      active: number; mrrCents: number; startedInWindow: number; canceledInWindow: number;
      activeAtWindowStart: number; everStarted: number;
    }> = {};

    for (const s of all) {
      const item = s.items.data[0];
      const price = item?.price;
      if (!price?.id) continue;
      const key = price.id;
      rows[key] ||= {
        price: key,
        product: typeof price.product === 'string' ? price.product : (price.product?.id ?? ''),
        currency: (price.currency || '').toUpperCase(),
        unitAmount: (price.unit_amount ?? 0) / 100,
        interval: price.recurring?.interval ?? 'one_time',
        active: 0, mrrCents: 0, startedInWindow: 0, canceledInWindow: 0, activeAtWindowStart: 0, everStarted: 0,
      };
      const r = rows[key];
      r.everStarted++;

      const live = s.status === 'active' || s.status === 'trialing';
      if (live) {
        r.active++;
        const amt = price.unit_amount ?? 0;
        const n = price.recurring?.interval_count || 1;
        if (price.recurring?.interval === 'month') r.mrrCents += amt / n;
        else if (price.recurring?.interval === 'year') r.mrrCents += amt / (12 * n);
        else if (price.recurring?.interval === 'week') r.mrrCents += (amt * 52) / 12 / n;
      }
      if (s.created >= since) r.startedInWindow++;
      if (s.canceled_at && s.canceled_at >= since) r.canceledInWindow++;
      // Base for the churn denominator: existed before the window and had not already been cancelled
      // when it opened. Without this, a cohort that only just started reads as ~0% churn purely
      // because its members have not had time to cancel.
      if (s.created < since && (!s.canceled_at || s.canceled_at >= since)) r.activeAtWindowStart++;
    }

    const byPrice = Object.values(rows)
      .map(r => {
        const churn = r.activeAtWindowStart > 0 ? r.canceledInWindow / r.activeAtWindowStart : null;
        return {
          ...r,
          mrr: Math.round(r.mrrCents) / 100,
          mrrCents: undefined,
          churnRate: churn === null ? null : Math.round(churn * 10000) / 100,
          // LTV = price / churn. Meaningless while the cohort has no completed billing cycle.
          impliedLtv: churn && churn > 0 ? Math.round((r.unitAmount / churn) * 100) / 100 : null,
          maxMrr: churn && churn > 0 ? Math.round((r.startedInWindow * r.unitAmount / churn) * 100) / 100 : null,
        };
      })
      .sort((a, b) => b.active - a.active);

    return NextResponse.json({
      windowDays: days,
      note: 'churnRate = canceled in window / active at window start, per price. activeAtWindowStart = 0 means the cohort is too young to have measurable churn.',
      pro5Price: 'price_1TrfY7KHJU6KLxM3Sme6WLZi',
      byPrice,
    });
  }

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
