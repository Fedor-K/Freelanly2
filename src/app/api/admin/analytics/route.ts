import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripe, STRIPE_PRICES } from '@/lib/stripe';
import { getEmailMarketingStats } from '@/lib/dashamail';
import { getTrialEmailStats } from '@/services/trial-emails';
import { getWinbackEmailStats } from '@/services/winback-emails';
import Stripe from 'stripe';

/**
 * Consolidated Analytics Endpoint
 * Returns all key metrics in one call:
 * - Stripe MRR, subscriptions, churn
 * - Cancellation feedback stats
 * - Email marketing stats (DashaMail)
 * - User funnel (signups → alerts → apply attempts → upgrades)
 * - Job stats
 */
export async function GET(request: NextRequest) {
  // Verify admin secret
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.CRON_SECRET;

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parallel fetch all data sources
    const [
      stripeData,
      cancellationData,
      emailData,
      funnelData,
      jobData,
      trialEmailData,
      winbackEmailData,
      retentionData,
    ] = await Promise.all([
      getStripeMetrics(thirtyDaysAgo, now),
      getCancellationFeedbackStats(),
      getEmailMarketingStats(),
      getUserFunnelMetrics(thirtyDaysAgo, sevenDaysAgo),
      getJobMetrics(thirtyDaysAgo),
      getTrialEmailStats(),
      getWinbackEmailStats(),
      getRetentionOfferStats(),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),

      // Revenue & Subscriptions
      stripe: stripeData,

      // Why users leave
      cancellations: cancellationData,

      // Email performance
      email: emailData,

      // Conversion funnel
      funnel: funnelData,

      // Content metrics
      jobs: jobData,

      // Trial email onboarding
      trialEmails: trialEmailData,

      // Win-back emails for churned users
      winbackEmails: winbackEmailData,

      // Retention offers (discount/pause at cancel)
      retention: retentionData,
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics', details: String(error) },
      { status: 500 }
    );
  }
}

// ============================================
// STRIPE METRICS
// ============================================
async function getStripeMetrics(thirtyDaysAgo: Date, now: Date) {
  try {
    const stripe = getStripe();

    const [activeSubscriptions, trialingSubscriptions, canceledSubscriptions] = await Promise.all([
      stripe.subscriptions.list({ status: 'active', limit: 100, expand: ['data.items.data.price'] }),
      stripe.subscriptions.list({ status: 'trialing', limit: 100 }),
      stripe.subscriptions.list({ status: 'canceled', limit: 100, created: { gte: Math.floor(thirtyDaysAgo.getTime() / 1000) } }),
    ]);

    // Calculate MRR
    let totalMRR = 0;
    const byPlan = { monthly: { count: 0, mrr: 0 }, quarterly: { count: 0, mrr: 0 }, annual: { count: 0, mrr: 0 } };

    for (const sub of activeSubscriptions.data) {
      const item = sub.items.data[0];
      if (!item?.price) continue;

      const price = item.price as Stripe.Price;
      const amount = price.unit_amount || 0;
      const interval = price.recurring?.interval;
      const intervalCount = price.recurring?.interval_count || 1;

      let monthlyAmount = 0;
      if (interval === 'month' && intervalCount === 3) monthlyAmount = amount / 3; // quarterly
      else if (interval === 'month') monthlyAmount = amount;
      else if (interval === 'year') monthlyAmount = amount / 12;

      totalMRR += monthlyAmount;

      const priceId = price.id;
      if (priceId === STRIPE_PRICES.monthly) { byPlan.monthly.count++; byPlan.monthly.mrr += monthlyAmount; }
      else if (priceId === STRIPE_PRICES.quarterly) { byPlan.quarterly.count++; byPlan.quarterly.mrr += monthlyAmount; }
      else if (priceId === STRIPE_PRICES.annual) { byPlan.annual.count++; byPlan.annual.mrr += monthlyAmount; }
    }

    // Trial conversion
    let trialsConverted = 0;
    for (const sub of activeSubscriptions.data) {
      if (sub.trial_end) {
        const trialEndDate = new Date(sub.trial_end * 1000);
        if (trialEndDate >= thirtyDaysAgo && trialEndDate <= now) trialsConverted++;
      }
    }

    let trialsCanceled = 0;
    for (const sub of canceledSubscriptions.data) {
      if (sub.trial_end) trialsCanceled++;
    }

    const totalTrialsCompleted = trialsConverted + trialsCanceled;
    const trialConversionRate = totalTrialsCompleted > 0 ? (trialsConverted / totalTrialsCompleted) * 100 : 0;

    // Churn
    const totalCanceled = canceledSubscriptions.data.length;
    const churnRate = (activeSubscriptions.data.length + totalCanceled) > 0
      ? (totalCanceled / (activeSubscriptions.data.length + totalCanceled)) * 100
      : 0;

    return {
      mrr: { total: (totalMRR / 100).toFixed(2), currency: 'EUR' },
      arr: { total: ((totalMRR * 12) / 100).toFixed(2), currency: 'EUR' },
      goal: {
        target: 10000,
        current: parseFloat((totalMRR / 100).toFixed(2)),
        progress: parseFloat(((totalMRR / 100 / 10000) * 100).toFixed(1)),
      },
      subscriptions: {
        active: activeSubscriptions.data.length,
        trialing: trialingSubscriptions.data.length,
        byPlan: {
          monthly: { count: byPlan.monthly.count, mrr: (byPlan.monthly.mrr / 100).toFixed(2) },
          quarterly: { count: byPlan.quarterly.count, mrr: (byPlan.quarterly.mrr / 100).toFixed(2) },
          annual: { count: byPlan.annual.count, mrr: (byPlan.annual.mrr / 100).toFixed(2) },
        },
      },
      trials: {
        current: trialingSubscriptions.data.length,
        converted30d: trialsConverted,
        canceled30d: trialsCanceled,
        conversionRate: parseFloat(trialConversionRate.toFixed(1)),
      },
      churn: {
        canceled30d: totalCanceled,
        rate: parseFloat(churnRate.toFixed(1)),
      },
    };
  } catch (error) {
    console.error('[Analytics] Stripe error:', error);
    return { error: 'Failed to fetch Stripe data' };
  }
}

// ============================================
// CANCELLATION FEEDBACK
// ============================================
async function getCancellationFeedbackStats() {
  try {
    const [total, byReason, recent] = await Promise.all([
      prisma.cancellationFeedback.count(),
      prisma.cancellationFeedback.groupBy({
        by: ['reason'],
        _count: true,
        orderBy: { _count: { reason: 'desc' } },
      }),
      prisma.cancellationFeedback.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          reason: true,
          otherText: true,
          feedback: true,
          createdAt: true,
        },
      }),
    ]);

    const reasonLabels: Record<string, string> = {
      TOO_EXPENSIVE: '💰 Too expensive',
      NOT_ENOUGH_JOBS: '📋 Not enough jobs',
      FOUND_JOB: '🎉 Found a job',
      NOT_USING: '⏰ Not using',
      MISSING_FEATURES: '🔧 Missing features',
      TECHNICAL_ISSUES: '🐛 Technical issues',
      POOR_JOB_QUALITY: '🎯 Poor job quality',
      OTHER: '💬 Other',
    };

    return {
      total,
      byReason: byReason.map(r => ({
        reason: reasonLabels[r.reason] || r.reason,
        count: r._count,
        percent: total > 0 ? parseFloat(((r._count / total) * 100).toFixed(1)) : 0,
      })),
      recent: recent.map(r => ({
        reason: reasonLabels[r.reason] || r.reason,
        otherText: r.otherText,
        feedback: r.feedback,
        date: r.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error('[Analytics] Cancellation error:', error);
    return { total: 0, byReason: [], recent: [] };
  }
}

// ============================================
// USER FUNNEL METRICS
// ============================================
async function getUserFunnelMetrics(thirtyDaysAgo: Date, sevenDaysAgo: Date) {
  try {
    const [
      totalUsers,
      usersLast30d,
      usersLast7d,
      proUsers,
      alertsCreated,
      applyAttempts30d,
      upgradesLast30d,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { plan: 'PRO' } }),
      prisma.jobAlert.count(),
      prisma.applyAttempt.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({
        where: {
          plan: 'PRO',
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

    // Conversion rates
    const alertCreationRate = totalUsers > 0 ? (alertsCreated / totalUsers) * 100 : 0;
    const upgradeRate = totalUsers > 0 ? (proUsers / totalUsers) * 100 : 0;

    return {
      users: {
        total: totalUsers,
        last30d: usersLast30d,
        last7d: usersLast7d,
        pro: proUsers,
        free: totalUsers - proUsers,
      },
      alerts: {
        total: alertsCreated,
        creationRate: parseFloat(alertCreationRate.toFixed(1)),
      },
      applyAttempts: {
        last30d: applyAttempts30d,
      },
      conversion: {
        freeToProRate: parseFloat(upgradeRate.toFixed(1)),
        upgrades30d: upgradesLast30d,
      },
    };
  } catch (error) {
    console.error('[Analytics] Funnel error:', error);
    return { users: {}, alerts: {}, applyAttempts: {}, conversion: {} };
  }
}

// ============================================
// JOB METRICS
// ============================================
async function getJobMetrics(thirtyDaysAgo: Date) {
  try {
    const [totalJobs, activeJobs, newJobs30d, totalCompanies] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { isActive: true } }),
      prisma.job.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.company.count(),
    ]);

    return {
      total: totalJobs,
      active: activeJobs,
      new30d: newJobs30d,
      companies: totalCompanies,
    };
  } catch (error) {
    console.error('[Analytics] Jobs error:', error);
    return { total: 0, active: 0, new30d: 0, companies: 0 };
  }
}

// ============================================
// RETENTION OFFER METRICS
// ============================================
async function getRetentionOfferStats() {
  try {
    const [total, byType, last30Days] = await Promise.all([
      prisma.retentionOffer.count(),
      prisma.retentionOffer.groupBy({
        by: ['offerType'],
        _count: true,
      }),
      prisma.retentionOffer.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    const byTypeMap: Record<string, number> = {};
    for (const item of byType) {
      byTypeMap[item.offerType] = item._count;
    }

    return {
      total,
      byType: byTypeMap,
      last30Days,
    };
  } catch (error) {
    console.error('[Analytics] Retention error:', error);
    return { total: 0, byType: {}, last30Days: 0 };
  }
}
