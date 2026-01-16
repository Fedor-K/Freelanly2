import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripe, STRIPE_PRICES } from '@/lib/stripe';
import { getMetrikaLastNDays, testMetrikaConnection } from '@/lib/yandex-metrika-api';
import { getTrialEmailStats } from '@/services/trial-emails';
import { getWinbackEmailStats } from '@/services/winback-emails';
import { getGSCStats } from '@/lib/google-search-console';
import { getTransactionalStats } from '@/lib/email';
import Stripe from 'stripe';

// Target: €10K MRR by May 2026
const TARGET_MRR = 10000;
const TARGET_DATE = new Date('2026-05-31');

/**
 * CEO Dashboard - Unified funnel metrics for $10K MRR goal
 * GET /api/admin/ceo-dashboard
 *
 * No auth required here - admin layout handles authentication
 */
export async function GET(_request: NextRequest) {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Parallel fetch all data
    const [
      stripeData,
      funnelData,
      trafficData,
      clarityData,
      churnData,
      emailData,
      trendsData,
      gscData,
    ] = await Promise.all([
      getStripeMetrics(thirtyDaysAgo, now),
      getFunnelMetrics(thirtyDaysAgo, sevenDaysAgo),
      getTrafficData(),
      getClarityData(),
      getChurnAnalysis(thirtyDaysAgo, sixtyDaysAgo),
      getEmailEffectiveness(thirtyDaysAgo),
      getDailyTrends(thirtyDaysAgo),
      getGSCStats(28), // Last 28 days of search data
    ]);

    // Calculate goal progress
    const currentMRR = stripeData.mrr?.totalCents ? stripeData.mrr.totalCents / 100 : 0;
    const daysRemaining = Math.max(0, Math.ceil((TARGET_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const remaining = Math.max(0, TARGET_MRR - currentMRR);
    const requiredDailyGrowth = daysRemaining > 0 ? remaining / daysRemaining : 0;
    const progressPercent = Math.min(100, (currentMRR / TARGET_MRR) * 100);

    // Build conversion funnel
    const funnel = buildFunnel(trafficData, funnelData, stripeData, currentMRR);

    // Generate alerts
    const alerts = generateAlerts(stripeData, churnData, funnel, requiredDailyGrowth, currentMRR);

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),

      // Goal Progress
      goal: {
        targetMRR: TARGET_MRR,
        currentMRR: parseFloat(currentMRR.toFixed(2)),
        progressPercent: parseFloat(progressPercent.toFixed(1)),
        remaining: parseFloat(remaining.toFixed(2)),
        targetDate: 'May 2025',
        daysRemaining,
        requiredDailyGrowth: parseFloat(requiredDailyGrowth.toFixed(2)),
      },

      // Conversion Funnel
      funnel,

      // Stripe Metrics
      stripe: stripeData,

      // Churn Analysis
      churn: churnData,

      // Email Effectiveness
      emails: emailData,

      // Traffic Sources
      traffic: trafficData,

      // UX Issues
      uxIssues: clarityData,

      // Google Search Console
      gsc: gscData,

      // 30-day Trends
      trends: trendsData,

      // Alerts & Recommendations
      alerts,
    });
  } catch (error) {
    console.error('[CEODashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: String(error) },
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
      if (interval === 'month' && intervalCount === 3) monthlyAmount = amount / 3;
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

    const totalCanceled = canceledSubscriptions.data.length;
    const churnRate = (activeSubscriptions.data.length + totalCanceled) > 0
      ? (totalCanceled / (activeSubscriptions.data.length + totalCanceled)) * 100
      : 0;

    return {
      mrr: { total: (totalMRR / 100).toFixed(2), totalCents: totalMRR, currency: 'EUR' },
      arr: { total: ((totalMRR * 12) / 100).toFixed(2), currency: 'EUR' },
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
    console.error('[CEODashboard] Stripe error:', error);
    return {
      mrr: { total: '0', totalCents: 0, currency: 'EUR' },
      arr: { total: '0', currency: 'EUR' },
      subscriptions: { active: 0, trialing: 0, byPlan: {} },
      trials: { current: 0, converted30d: 0, canceled30d: 0, conversionRate: 0 },
      churn: { canceled30d: 0, rate: 0 },
    };
  }
}

// ============================================
// FUNNEL METRICS FROM DB
// ============================================
async function getFunnelMetrics(thirtyDaysAgo: Date, sevenDaysAgo: Date) {
  try {
    const [
      totalUsers,
      usersLast30d,
      usersLast7d,
      proUsers,
      proUsersNew30d,
      usersWithAlerts,
      activeAlerts,
      applyAttempts30d,
      uniqueAttemptUsers30d,
      convertedAttempts30d,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.user.count({ where: { plan: 'PRO' } }),
      prisma.user.count({ where: { plan: 'PRO', updatedAt: { gte: thirtyDaysAgo } } }),
      prisma.user.count({ where: { jobAlerts: { some: {} } } }),
      prisma.jobAlert.count({ where: { isActive: true } }),
      prisma.applyAttempt.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.applyAttempt.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: thirtyDaysAgo } },
      }).then(r => r.length),
      prisma.applyAttempt.count({
        where: { converted: true, convertedAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    return {
      totalUsers,
      usersLast30d,
      usersLast7d,
      proUsers,
      proUsersNew30d,
      usersWithAlerts,
      activeAlerts,
      applyAttempts30d,
      uniqueAttemptUsers30d,
      convertedAttempts30d,
    };
  } catch (error) {
    console.error('[CEODashboard] Funnel error:', error);
    return {
      totalUsers: 0, usersLast30d: 0, usersLast7d: 0, proUsers: 0, proUsersNew30d: 0,
      usersWithAlerts: 0, activeAlerts: 0, applyAttempts30d: 0, uniqueAttemptUsers30d: 0, convertedAttempts30d: 0,
    };
  }
}

// ============================================
// TRAFFIC DATA (Yandex Metrika)
// ============================================
async function getTrafficData() {
  try {
    const isConnected = await testMetrikaConnection();
    if (!isConnected) {
      return {
        source: 'unavailable' as const,
        sessions30d: 0,
        visitors30d: 0,
        sources: { organic: 0, direct: 0, social: 0, referral: 0, email: 0, other: 0 },
        topPages: [],
      };
    }

    const stats = await getMetrikaLastNDays(30);
    return {
      source: 'metrika' as const,
      sessions30d: stats.visits,
      visitors30d: stats.visitors,
      sources: stats.sources,
      topPages: stats.topPages.slice(0, 5),
    };
  } catch (error) {
    console.error('[CEODashboard] Traffic error:', error);
    return {
      source: 'unavailable' as const,
      sessions30d: 0,
      visitors30d: 0,
      sources: { organic: 0, direct: 0, social: 0, referral: 0, email: 0, other: 0 },
      topPages: [],
    };
  }
}

// ============================================
// CLARITY DATA (UX Issues)
// ============================================
async function getClarityData() {
  try {
    const CLARITY_TOKEN = process.env.CLARITY_API_TOKEN;
    if (!CLARITY_TOKEN) {
      console.log('[CEODashboard] CLARITY_API_TOKEN not set');
      return { available: false, deadClicks: 0, rageClicks: 0, quickBack: 0, scriptErrors: 0, hasIssues: false };
    }

    // Use numOfDays=3 like the working endpoint
    const res = await fetch(
      'https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3',
      {
        headers: { 'Authorization': `Bearer ${CLARITY_TOKEN}` },
        cache: 'no-store', // Don't cache to avoid stale data issues
      }
    );

    if (!res.ok) {
      console.error('[CEODashboard] Clarity API returned:', res.status);
      return { available: false, deadClicks: 0, rageClicks: 0, quickBack: 0, scriptErrors: 0, hasIssues: false };
    }

    const data = await res.json();

    if (!Array.isArray(data)) {
      console.error('[CEODashboard] Clarity returned non-array:', typeof data);
      return { available: false, deadClicks: 0, rageClicks: 0, quickBack: 0, scriptErrors: 0, hasIssues: false };
    }

    const metrics: Record<string, unknown> = {};
    for (const item of data) {
      metrics[item.metricName] = item.information;
    }

    const deadClicks = parseFloat((metrics.DeadClickCount as Array<{ sessionsWithMetricPercentage: string }>)?.[0]?.sessionsWithMetricPercentage) || 0;
    const rageClicks = parseFloat((metrics.RageClickCount as Array<{ sessionsWithMetricPercentage: string }>)?.[0]?.sessionsWithMetricPercentage) || 0;
    const quickBack = parseFloat((metrics.QuickbackClick as Array<{ sessionsWithMetricPercentage: string }>)?.[0]?.sessionsWithMetricPercentage) || 0;
    const scriptErrors = parseFloat((metrics.ScriptErrorCount as Array<{ sessionsWithMetricPercentage: string }>)?.[0]?.sessionsWithMetricPercentage) || 0;

    return {
      available: true,
      deadClicks,
      rageClicks,
      quickBack,
      scriptErrors,
      hasIssues: deadClicks > 5 || rageClicks > 5 || quickBack > 5 || scriptErrors > 5,
    };
  } catch (error) {
    console.error('[CEODashboard] Clarity error:', error);
    return { available: false, deadClicks: 0, rageClicks: 0, quickBack: 0, scriptErrors: 0, hasIssues: false };
  }
}

// ============================================
// CHURN ANALYSIS
// ============================================
async function getChurnAnalysis(thirtyDaysAgo: Date, sixtyDaysAgo: Date) {
  try {
    const [total, byReason, recent, current30d, previous30d] = await Promise.all([
      prisma.cancellationFeedback.count(),
      prisma.cancellationFeedback.groupBy({
        by: ['reason'],
        _count: true,
        orderBy: { _count: { reason: 'desc' } },
      }),
      prisma.cancellationFeedback.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { reason: true, feedback: true, createdAt: true },
      }),
      prisma.cancellationFeedback.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.cancellationFeedback.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    ]);

    const reasonLabels: Record<string, string> = {
      TOO_EXPENSIVE: 'Too expensive',
      NOT_ENOUGH_JOBS: 'Not enough jobs',
      FOUND_JOB: 'Found a job',
      NOT_USING: 'Not using',
      MISSING_FEATURES: 'Missing features',
      TECHNICAL_ISSUES: 'Technical issues',
      POOR_JOB_QUALITY: 'Poor job quality',
      OTHER: 'Other',
    };

    const trendChange = previous30d > 0 ? ((current30d - previous30d) / previous30d) * 100 : 0;

    return {
      total,
      byReason: byReason.map(r => ({
        reason: r.reason,
        label: reasonLabels[r.reason] || r.reason,
        count: r._count,
        percent: total > 0 ? parseFloat(((r._count / total) * 100).toFixed(1)) : 0,
      })),
      topReason: byReason[0] ? reasonLabels[byReason[0].reason] || byReason[0].reason : 'N/A',
      recentFeedback: recent.map(r => ({
        reason: reasonLabels[r.reason] || r.reason,
        feedback: r.feedback,
        date: r.createdAt.toISOString(),
      })),
      trend: {
        current30d,
        previous30d,
        change: parseFloat(trendChange.toFixed(1)),
      },
    };
  } catch (error) {
    console.error('[CEODashboard] Churn error:', error);
    return {
      total: 0, byReason: [], topReason: 'N/A', recentFeedback: [],
      trend: { current30d: 0, previous30d: 0, change: 0 },
    };
  }
}

// ============================================
// EMAIL EFFECTIVENESS
// ============================================
async function getEmailEffectiveness(thirtyDaysAgo: Date) {
  try {
    const [trialStats, winbackStats, abandonedStats, alertStats, dashamailStats] = await Promise.all([
      getTrialEmailStats(),
      getWinbackEmailStats(),
      getAbandonedCheckoutStats(thirtyDaysAgo),
      getAlertEmailStats(thirtyDaysAgo),
      getTransactionalStats(30),
    ]);

    return {
      trial: trialStats,
      winback: winbackStats,
      abandonedCheckout: abandonedStats,
      alerts: alertStats,
      // DashaMail transactional stats (opens, clicks from email provider)
      dashamail: {
        opened: dashamailStats.opened,
        clicked: dashamailStats.clicked,
        bounced: dashamailStats.bounced,
        unsubscribed: dashamailStats.unsubscribed,
        // Calculate rates using DB sent count since DashaMail sent=0 bug
        openRate: alertStats.sent30d > 0
          ? parseFloat(((dashamailStats.opened / alertStats.sent30d) * 100).toFixed(1))
          : 0,
        clickRate: alertStats.sent30d > 0
          ? parseFloat(((dashamailStats.clicked / alertStats.sent30d) * 100).toFixed(1))
          : 0,
      },
    };
  } catch (error) {
    console.error('[CEODashboard] Email error:', error);
    return {
      trial: { totalSent: 0, byType: {}, last7Days: 0 },
      winback: { totalSent: 0, byType: {}, resubscribed: 0, conversionRate: 0 },
      abandonedCheckout: { totalSent: 0, converted: 0, conversionRate: 0 },
      alerts: { sent30d: 0 },
      dashamail: { opened: 0, clicked: 0, bounced: 0, unsubscribed: 0, openRate: 0, clickRate: 0 },
    };
  }
}

async function getAbandonedCheckoutStats(thirtyDaysAgo: Date) {
  const [totalSent, converted] = await Promise.all([
    prisma.abandonedCheckoutEmail.count({ where: { sentAt: { gte: thirtyDaysAgo } } }),
    prisma.abandonedCheckoutEmail.count({ where: { convertedAt: { not: null }, sentAt: { gte: thirtyDaysAgo } } }),
  ]);

  return {
    totalSent,
    converted,
    conversionRate: totalSent > 0 ? parseFloat(((converted / totalSent) * 100).toFixed(1)) : 0,
  };
}

async function getAlertEmailStats(thirtyDaysAgo: Date) {
  const sent30d = await prisma.alertNotification.count({
    where: { status: 'SENT', sentAt: { gte: thirtyDaysAgo } },
  });

  return { sent30d };
}

// ============================================
// DAILY TRENDS
// ============================================
async function getDailyTrends(thirtyDaysAgo: Date) {
  try {
    const metrics = await prisma.dailyMetric.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'asc' },
      select: {
        date: true,
        netMRR: true,
        newSignups: true,
        paidConversions: true,
        churns: true,
      },
    });

    return {
      last30Days: metrics.map(m => ({
        date: m.date.toISOString().slice(0, 10),
        mrr: (m.netMRR || 0) / 100,
        signups: m.newSignups || 0,
        conversions: m.paidConversions || 0,
        churns: m.churns || 0,
      })),
    };
  } catch (error) {
    console.error('[CEODashboard] Trends error:', error);
    return { last30Days: [] };
  }
}

// ============================================
// BUILD FUNNEL
// ============================================
function buildFunnel(
  trafficData: Awaited<ReturnType<typeof getTrafficData>>,
  funnelData: Awaited<ReturnType<typeof getFunnelMetrics>>,
  stripeData: Awaited<ReturnType<typeof getStripeMetrics>>,
  currentMRR: number
) {
  const traffic = trafficData.sessions30d || 0;
  const registrations = funnelData.usersLast30d || 0;
  const usersWithAlerts = funnelData.usersWithAlerts || 0;
  const paywallHits = funnelData.uniqueAttemptUsers30d || 0;
  const proUsers = stripeData.subscriptions?.active || 0;

  return {
    traffic: {
      value: traffic,
      source: trafficData.source,
    },
    registrations: {
      value: registrations,
      total: funnelData.totalUsers,
      conversionFromTraffic: traffic > 0 ? parseFloat(((registrations / traffic) * 100).toFixed(1)) : 0,
    },
    jobAlerts: {
      value: usersWithAlerts,
      activeAlerts: funnelData.activeAlerts,
      conversionFromRegistration: funnelData.totalUsers > 0
        ? parseFloat(((usersWithAlerts / funnelData.totalUsers) * 100).toFixed(1))
        : 0,
    },
    paywallHits: {
      value: paywallHits,
      total30d: funnelData.applyAttempts30d,
      conversionFromAlerts: usersWithAlerts > 0
        ? parseFloat(((paywallHits / usersWithAlerts) * 100).toFixed(1))
        : 0,
    },
    proUsers: {
      value: proUsers,
      new30d: funnelData.proUsersNew30d,
      trialing: stripeData.trials?.current || 0,
      conversionFromPaywall: paywallHits > 0
        ? parseFloat(((proUsers / paywallHits) * 100).toFixed(1))
        : 0,
    },
    mrr: {
      value: currentMRR,
      currency: 'EUR',
      arpu: proUsers > 0 ? parseFloat((currentMRR / proUsers).toFixed(2)) : 0,
    },
  };
}

// ============================================
// GENERATE ALERTS
// ============================================
function generateAlerts(
  stripeData: Awaited<ReturnType<typeof getStripeMetrics>>,
  churnData: Awaited<ReturnType<typeof getChurnAnalysis>>,
  funnel: ReturnType<typeof buildFunnel>,
  requiredDailyGrowth: number,
  currentMRR: number
) {
  const alerts: Array<{ type: 'warning' | 'critical' | 'success' | 'info'; title: string; message: string }> = [];

  // Churn alerts
  if (stripeData.churn?.rate > 5) {
    alerts.push({
      type: 'warning',
      title: 'High Churn Rate',
      message: `Churn at ${stripeData.churn.rate}% (target: <5%)`,
    });
  }

  if (churnData.trend?.change > 20) {
    alerts.push({
      type: 'warning',
      title: 'Churn Increasing',
      message: `+${churnData.trend.change}% vs previous 30 days`,
    });
  }

  // Trial conversion
  if (stripeData.trials?.conversionRate < 40 && stripeData.trials?.conversionRate > 0) {
    alerts.push({
      type: 'warning',
      title: 'Low Trial Conversion',
      message: `Only ${stripeData.trials.conversionRate}% converting (target: 50%)`,
    });
  }

  // MRR goal tracking
  if (requiredDailyGrowth > 100) {
    alerts.push({
      type: 'critical',
      title: 'MRR Behind Target',
      message: `Need €${requiredDailyGrowth.toFixed(0)}/day to reach €10K by May`,
    });
  } else if (requiredDailyGrowth > 50) {
    alerts.push({
      type: 'warning',
      title: 'MRR Needs Acceleration',
      message: `Need €${requiredDailyGrowth.toFixed(0)}/day growth`,
    });
  }

  // Milestones
  if (currentMRR >= 5000 && currentMRR < 5100) {
    alerts.push({
      type: 'success',
      title: 'Milestone Reached!',
      message: '€5,000 MRR - halfway to goal!',
    });
  }

  if (currentMRR >= 2500 && currentMRR < 2600) {
    alerts.push({
      type: 'success',
      title: 'Milestone Reached!',
      message: '€2,500 MRR - 25% of goal!',
    });
  }

  // Funnel issues
  if (funnel.registrations.conversionFromTraffic < 2 && funnel.traffic.value > 1000) {
    alerts.push({
      type: 'info',
      title: 'Low Registration Rate',
      message: `Only ${funnel.registrations.conversionFromTraffic}% of visitors register`,
    });
  }

  if (funnel.proUsers.conversionFromPaywall < 10 && funnel.paywallHits.value > 50) {
    alerts.push({
      type: 'info',
      title: 'Low Paywall Conversion',
      message: `Only ${funnel.proUsers.conversionFromPaywall}% convert at paywall`,
    });
  }

  return alerts;
}
