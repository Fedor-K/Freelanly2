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
  // ?all=1 — every charge the account has ever taken, from Stripe rather than from our own
  // RevenueEvent table. Our copy is known to be incomplete: the inline Go-PRO flow wrote no revenue
  // rows until 2026-08-11, and a cleanup job deleted the User rows of 108 of 150 all-time payers, so
  // anything joined through userId under-reports. Money questions get answered here.
  if (searchParams.get('all') === '1') {
    const charges: Stripe.Charge[] = [];
    for await (const c of stripe.charges.list({ limit: 100 })) charges.push(c);

    // Invoices carry the price, charges do not — this maps a charge back to what was sold.
    const invoicePrice = new Map<string, { price: string; nickname: string }>();
    for await (const inv of stripe.invoices.list({ limit: 100, expand: ['data.lines'] })) {
      const line = inv.lines?.data?.[0];
      const rawPrice = (line as unknown as { pricing?: { price_details?: { price?: string } } })?.pricing?.price_details?.price;
      const price = typeof rawPrice === 'string' ? rawPrice : '';
      if (inv.id && price) {
        invoicePrice.set(inv.id, {
          price,
          nickname: `${((line?.amount ?? 0) / 100).toFixed(2)} ${(inv.currency || '').toUpperCase()}`,
        });
      }
    }

    // Keyed by month AND currency. Keying by month alone summed EUR and USD into one figure, which
    // is not a number that exists — this account has sold in both.
    const byMonth: Record<string, { month: string; currency: string; gross: number; refunded: number; net: number; count: number }> = {};
    const byPrice: Record<string, { price: string; label: string; gross: number; refunded: number; count: number; customers: Set<string> }> = {};
    const declines: Record<string, number> = {};
    const declinesByMonth: Record<string, { month: string; failed: number; succeeded: number }> = {};
    let gross = 0, refunded = 0, failed = 0;
    const currencies: Record<string, number> = {};
    const customers = new Set<string>();

    for (const c of charges) {
      const m = new Date(c.created * 1000).toISOString().slice(0, 7);
      declinesByMonth[m] ||= { month: m, failed: 0, succeeded: 0 };
      if (c.status !== 'succeeded') {
        failed++;
        declinesByMonth[m].failed++;
        // The issuer's own reason. This is the difference between "no money" and "this card cannot
        // do this kind of purchase at all", which is a product decision, not a dunning problem.
        const reason = c.outcome?.reason || c.failure_code || 'unknown';
        declines[reason] = (declines[reason] || 0) + 1;
        continue;
      }
      declinesByMonth[m].succeeded++;
      const month = m;
      const cur = (c.currency || '').toUpperCase();
      const amt = c.amount / 100;
      const ref = (c.amount_refunded || 0) / 100;
      gross += amt; refunded += ref;
      currencies[cur] = (currencies[cur] || 0) + amt;
      if (typeof c.customer === 'string') customers.add(c.customer);

      const mk = `${month}|${cur}`;
      byMonth[mk] ||= { month, currency: cur, gross: 0, refunded: 0, net: 0, count: 0 };
      byMonth[mk].gross += amt; byMonth[mk].refunded += ref;
      byMonth[mk].net += amt - ref; byMonth[mk].count++;

      // `invoice` was dropped from the Charge type in the pinned API version but is still sent.
      const chargeInvoice = (c as unknown as { invoice?: string | { id?: string } }).invoice;
      const invId = typeof chargeInvoice === 'string' ? chargeInvoice : chargeInvoice?.id;
      const mapped = invId ? invoicePrice.get(invId) : undefined;
      // No invoice means a bare PaymentIntent — our one-time credit packs are the only such charges.
      const key = mapped?.price || (c.metadata?.type ? `one_time:${c.metadata.type}` : 'one_time:unattributed');
      byPrice[key] ||= { price: key, label: mapped?.nickname || `${amt.toFixed(2)} ${cur}`, gross: 0, refunded: 0, count: 0, customers: new Set() };
      byPrice[key].gross += amt; byPrice[key].refunded += ref; byPrice[key].count++;
      if (typeof c.customer === 'string') byPrice[key].customers.add(c.customer);
    }

    return NextResponse.json({
      note: 'Every succeeded charge on this Stripe account, all time. Amounts are summed per currency as charged — they are NOT converted, so do not add USD and EUR figures together.',
      totals: {
        charges: charges.length,
        succeeded: charges.length - failed,
        failed,
        payingCustomers: customers.size,
        grossByCurrency: currencies,
        gross: Math.round(gross * 100) / 100,
        refunded: Math.round(refunded * 100) / 100,
        net: Math.round((gross - refunded) * 100) / 100,
      },
      declineReasons: Object.entries(declines).sort((a, b) => b[1] - a[1]).map(([reason, n]) => ({ reason, charges: n })),
      attemptsByMonth: Object.values(declinesByMonth).sort((a, b) => a.month.localeCompare(b.month))
        .map((v) => ({ ...v, failRate: v.failed + v.succeeded > 0 ? Math.round((100 * v.failed) / (v.failed + v.succeeded)) : null })),
      byMonth: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month) || a.currency.localeCompare(b.currency))
        .map((v) => ({ ...v, gross: Math.round(v.gross * 100) / 100, refunded: Math.round(v.refunded * 100) / 100, net: Math.round(v.net * 100) / 100 })),
      byPrice: Object.values(byPrice).sort((a, b) => b.gross - a.gross)
        .map((v) => ({ price: v.price, label: v.label, charges: v.count, customers: v.customers.size, gross: Math.round(v.gross * 100) / 100, refunded: Math.round(v.refunded * 100) / 100 })),
    });
  }

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
      byStatus: Record<string, number>; everPaid: number; paidThenCanceled: number;
      neverPaid: number; scheduledToCancel: number; paidByWeek: Record<string, number>;
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
        byStatus: {}, everPaid: 0, paidThenCanceled: 0, neverPaid: 0, scheduledToCancel: 0, paidByWeek: {},
      };
      const r = rows[key];
      r.everStarted++;
      r.byStatus[s.status] = (r.byStatus[s.status] || 0) + 1;

      // The inline Go-PRO flow creates a subscription with payment_behavior 'default_incomplete' on
      // every click, so an abandoned payment form leaves a real subscription object behind. Counting
      // those as churn would report an abandoned checkout as a lost customer. A subscription that was
      // actually paid has advanced past the incomplete states at least once — `incomplete` and
      // `incomplete_expired` never took a payment, so they are attempts, not customers.
      const neverPaid = s.status === 'incomplete' || s.status === 'incomplete_expired';
      if (neverPaid) r.neverPaid++;
      else r.everPaid++;
      if (!neverPaid && s.status === 'canceled') r.paidThenCanceled++;
      if (s.cancel_at_period_end) r.scheduledToCancel++;
      // Acquisition cadence for PAID subscriptions only, bucketed by ISO week of creation. Our own
      // proStartedAt is not written by the payment webhook (only the pre-inline checkout path set it),
      // so the database reads as "acquisition stopped on Jul 31" — the day the inline flow shipped.
      // Stripe's creation dates are the only trustworthy series.
      if (!neverPaid) {
        const d = new Date(s.created * 1000);
        const wk = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)))
          .toISOString().slice(5, 10);
        r.paidByWeek[wk] = (r.paidByWeek[wk] || 0) + 1;
      }

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
      // Only real customers can churn: an abandoned inline attempt also carries a canceled_at.
      if (!neverPaid && s.canceled_at && s.canceled_at >= since) r.canceledInWindow++;
      // Base for the churn denominator: existed before the window and had not already been cancelled
      // when it opened. Without this, a cohort that only just started reads as ~0% churn purely
      // because its members have not had time to cancel.
      if (!neverPaid && s.created < since && (!s.canceled_at || s.canceled_at >= since)) r.activeAtWindowStart++;
    }

    const byPrice = Object.values(rows)
      .map(r => {
        const churn = r.activeAtWindowStart > 0 ? r.canceledInWindow / r.activeAtWindowStart : null;
        // Share of paid subscriptions that are already gone, whatever their age. With a cohort younger
        // than one billing cycle this is the only honest retention read available.
        const deadShare = r.everPaid > 0 ? r.paidThenCanceled / r.everPaid : null;
        return {
          ...r,
          mrr: Math.round(r.mrrCents) / 100,
          mrrCents: undefined,
          paidThenCanceledPct: deadShare === null ? null : Math.round(deadShare * 10000) / 100,
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
