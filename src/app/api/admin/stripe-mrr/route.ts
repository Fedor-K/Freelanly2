import { NextRequest, NextResponse } from 'next/server';
import { getStripe, STRIPE_PRICES } from '@/lib/stripe';
import Stripe from 'stripe';

/**
 * Get Stripe MRR and subscription metrics
 * Protected by CRON_SECRET (same as other admin endpoints)
 */
export async function GET(request: NextRequest) {
  // Verify admin secret
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stripe = getStripe();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all active subscriptions
    const activeSubscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
      expand: ['data.items.data.price'],
    });

    // Get trialing subscriptions
    const trialingSubscriptions = await stripe.subscriptions.list({
      status: 'trialing',
      limit: 100,
      expand: ['data.items.data.price'],
    });

    // Get canceled subscriptions in last 30 days (for churn)
    const canceledSubscriptions = await stripe.subscriptions.list({
      status: 'canceled',
      limit: 100,
      created: {
        gte: Math.floor(thirtyDaysAgo.getTime() / 1000),
      },
    });

    // Calculate MRR from active subscriptions
    let totalMRR = 0;
    const subscriptionsByPlan: Record<string, { count: number; mrr: number }> = {
      weekly: { count: 0, mrr: 0 },
      monthly: { count: 0, mrr: 0 },
      annual: { count: 0, mrr: 0 },
      other: { count: 0, mrr: 0 },
    };

    for (const sub of activeSubscriptions.data) {
      const item = sub.items.data[0];
      if (!item?.price) continue;

      const price = item.price as Stripe.Price;
      const amount = price.unit_amount || 0;
      const interval = price.recurring?.interval;
      const intervalCount = price.recurring?.interval_count || 1;

      // Convert to monthly amount (MRR)
      let monthlyAmount = 0;
      if (interval === 'week') {
        monthlyAmount = (amount * 4.33) / intervalCount; // ~4.33 weeks per month
      } else if (interval === 'month') {
        monthlyAmount = amount / intervalCount;
      } else if (interval === 'year') {
        monthlyAmount = amount / (12 * intervalCount);
      }

      totalMRR += monthlyAmount;

      // Categorize by plan
      const priceId = price.id;
      if (priceId === STRIPE_PRICES.weekly) {
        subscriptionsByPlan.weekly.count++;
        subscriptionsByPlan.weekly.mrr += monthlyAmount;
      } else if (priceId === STRIPE_PRICES.monthly) {
        subscriptionsByPlan.monthly.count++;
        subscriptionsByPlan.monthly.mrr += monthlyAmount;
      } else if (priceId === STRIPE_PRICES.annual) {
        subscriptionsByPlan.annual.count++;
        subscriptionsByPlan.annual.mrr += monthlyAmount;
      } else {
        subscriptionsByPlan.other.count++;
        subscriptionsByPlan.other.mrr += monthlyAmount;
      }
    }

    // Calculate trial stats
    const totalTrialing = trialingSubscriptions.data.length;

    // Get completed trials in last 30 days (trials that converted to active)
    // We look at active subscriptions that had a trial and trial ended in last 30 days
    let trialsConverted = 0;
    for (const sub of activeSubscriptions.data) {
      if (sub.trial_end) {
        const trialEndDate = new Date(sub.trial_end * 1000);
        if (trialEndDate >= thirtyDaysAgo && trialEndDate <= now) {
          trialsConverted++;
        }
      }
    }

    // Trials that churned (canceled during or right after trial)
    let trialsCanceled = 0;
    for (const sub of canceledSubscriptions.data) {
      if (sub.trial_end) {
        trialsCanceled++;
      }
    }

    const totalTrialsCompleted = trialsConverted + trialsCanceled;
    const trialConversionRate = totalTrialsCompleted > 0
      ? ((trialsConverted / totalTrialsCompleted) * 100).toFixed(1)
      : '0';

    // Calculate churn
    const totalCanceled30d = canceledSubscriptions.data.length;
    const totalActiveStart = activeSubscriptions.data.length + totalCanceled30d;
    const churnRate = totalActiveStart > 0
      ? ((totalCanceled30d / totalActiveStart) * 100).toFixed(1)
      : '0';

    // Calculate ARR
    const totalARR = totalMRR * 12;

    // Progress to $10K goal
    const goalMRR = 10000 * 100; // $10K in cents
    const progressToGoal = ((totalMRR / goalMRR) * 100).toFixed(1);

    // Format amounts for display (convert cents to dollars/euros)
    const formatAmount = (cents: number) => (cents / 100).toFixed(2);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),

      // Main metrics
      mrr: {
        total: formatAmount(totalMRR),
        totalCents: Math.round(totalMRR),
        currency: 'EUR',
      },
      arr: {
        total: formatAmount(totalARR),
        totalCents: Math.round(totalARR),
        currency: 'EUR',
      },

      // Goal tracking
      goal: {
        targetMRR: 10000,
        currentMRR: parseFloat(formatAmount(totalMRR)),
        progressPercent: parseFloat(progressToGoal),
        remaining: Math.max(0, 10000 - parseFloat(formatAmount(totalMRR))),
      },

      // Subscriptions breakdown
      subscriptions: {
        total: activeSubscriptions.data.length,
        byPlan: {
          weekly: {
            count: subscriptionsByPlan.weekly.count,
            mrr: formatAmount(subscriptionsByPlan.weekly.mrr),
          },
          monthly: {
            count: subscriptionsByPlan.monthly.count,
            mrr: formatAmount(subscriptionsByPlan.monthly.mrr),
          },
          annual: {
            count: subscriptionsByPlan.annual.count,
            mrr: formatAmount(subscriptionsByPlan.annual.mrr),
          },
        },
      },

      // Trial metrics
      trials: {
        currentlyTrialing: totalTrialing,
        convertedLast30d: trialsConverted,
        canceledLast30d: trialsCanceled,
        conversionRate: parseFloat(trialConversionRate),
      },

      // Churn metrics
      churn: {
        canceledLast30d: totalCanceled30d,
        churnRate: parseFloat(churnRate),
      },

      // Raw counts for debugging
      _debug: {
        activeCount: activeSubscriptions.data.length,
        trialingCount: trialingSubscriptions.data.length,
        canceledCount: canceledSubscriptions.data.length,
      },
    });
  } catch (error) {
    console.error('[StripeMRR] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Stripe metrics', details: String(error) },
      { status: 500 }
    );
  }
}
