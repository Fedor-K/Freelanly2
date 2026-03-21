import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { PRICE_INFO } from '@/lib/stripe';
import { getAccountReport } from '@/lib/google-ads';

/**
 * GET /api/admin/dashboard
 * CEO dashboard metrics — key numbers for daily/weekly review
 */
export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const prevMonthStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // === TIER 1: Big Numbers ===

    // PRO subscribers count
    const proCount = await prisma.user.count({ where: { plan: 'PRO' } });
    const proCountWeekAgo = await prisma.user.count({
      where: { plan: 'PRO', createdAt: { lte: weekAgo } },
    });

    // MRR calculation (from active PRO users and their Stripe subscriptions)
    // Simplified: count PRO users, assume average plan mix
    const proUsers = await prisma.user.findMany({
      where: { plan: 'PRO' },
      select: { stripeSubscriptionId: true },
    });
    // Estimate MRR: assume €15/month average (most are monthly)
    const estimatedMRR = proCount * 15;

    // Signups today & yesterday
    const signupsToday = await prisma.user.count({ where: { createdAt: { gte: todayStart } } });
    const signupsYesterday = await prisma.user.count({
      where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
    });
    const signupsWeek = await prisma.user.count({ where: { createdAt: { gte: weekAgo } } });

    // New PRO today
    const newProToday = await prisma.activityLog.count({
      where: {
        action: 'CHECKOUT_COMPLETE',
        createdAt: { gte: todayStart },
      },
    });
    const newProYesterday = await prisma.activityLog.count({
      where: {
        action: 'CHECKOUT_COMPLETE',
        createdAt: { gte: yesterdayStart, lt: todayStart },
      },
    });
    const newProWeek = await prisma.activityLog.count({
      where: {
        action: 'CHECKOUT_COMPLETE',
        createdAt: { gte: weekAgo },
      },
    });

    // === TIER 2: Health Metrics ===

    // Total users
    const totalUsers = await prisma.user.count();

    // Conversion rate (PRO / total verified users)
    const verifiedUsers = await prisma.user.count({ where: { emailVerified: { not: null } } });
    const conversionRate = verifiedUsers > 0 ? Math.round((proCount / verifiedUsers) * 1000) / 10 : 0;

    // Churn (cancelled subscriptions in last 30 days)
    const churned30d = await prisma.activityLog.count({
      where: {
        action: 'SUBSCRIPTION_CANCELLED',
        createdAt: { gte: monthAgo },
      },
    });
    const churnRate = proCount > 0 ? Math.round((churned30d / (proCount + churned30d)) * 1000) / 10 : 0;

    // Signups by source (last 7 days)
    const signupsBySource = await prisma.$queryRaw<Array<{ src: string; cnt: bigint }>>`
      SELECT COALESCE(source, 'direct') as src, COUNT(*) as cnt
      FROM "User"
      WHERE "createdAt" >= ${weekAgo}
      GROUP BY COALESCE(source, 'direct')
      ORDER BY cnt DESC
      LIMIT 5
    `;

    // === TIER 3: Activity Feed ===

    // Recent important events
    const recentEvents = await prisma.activityLog.findMany({
      where: {
        action: { in: ['CHECKOUT_COMPLETE', 'SUBSCRIPTION_CANCELLED', 'SIGNUP', 'LOGIN'] },
        createdAt: { gte: yesterdayStart },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    // Daily signups for chart (last 14 days)
    const dailySignups = await prisma.$queryRaw<Array<{ day: Date; cnt: bigint }>>`
      SELECT DATE("createdAt") as day, COUNT(*) as cnt
      FROM "User"
      WHERE "createdAt" >= ${new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)}
      GROUP BY DATE("createdAt")
      ORDER BY day ASC
    `;

    // Daily revenue events for chart
    const dailyRevenue = await prisma.$queryRaw<Array<{ day: Date; cnt: bigint; total: string | null }>>`
      SELECT DATE("createdAt") as day, COUNT(*) as cnt,
        SUM(CASE WHEN details->>'amount' IS NOT NULL THEN (details->>'amount')::numeric ELSE 0 END) as total
      FROM "ActivityLog"
      WHERE action IN ('CHECKOUT_COMPLETE', 'SUBSCRIPTION_STARTED')
        AND "createdAt" >= ${new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)}
      GROUP BY DATE("createdAt")
      ORDER BY day ASC
    `;

    // Paywall funnel today
    const funnelToday = await prisma.$queryRaw<Array<{ action: string; cnt: bigint }>>`
      SELECT action, COUNT(DISTINCT "userId") as cnt
      FROM "ActivityLog"
      WHERE "createdAt" >= ${todayStart}
        AND "userId" IS NOT NULL
        AND action IN ('PAGE_VIEW', 'JOB_VIEW', 'OPPORTUNITY_VIEW', 'PAYWALL_HIT', 'UPGRADE_MODAL_OPEN', 'PRICING_VIEW', 'CHECKOUT_START', 'CHECKOUT_COMPLETE')
      GROUP BY action
    `;

    // Email stats today
    const emailsToday = await prisma.activityLog.count({
      where: { action: 'EMAIL_SENT', createdAt: { gte: todayStart } },
    });
    const emailOpensToday = await prisma.activityLog.count({
      where: { action: 'ALERT_EMAIL_OPEN', createdAt: { gte: todayStart } },
    });

    // Chat messages today
    const chatToday = await prisma.activityLog.count({
      where: { action: 'CHAT_MESSAGE', createdAt: { gte: todayStart } },
    });

    // === GOOGLE ADS ROI ===
    let adsData = { spend: 0, clicks: 0, impressions: 0, regsFromAds: 0, prosFromAds: 0, cpr: 0, cac: 0, revenue: 0, roi: 0 };
    try {
      const thirtyDaysAgoStr = new Date(monthAgo).toISOString().split('T')[0];
      const todayStr = now.toISOString().split('T')[0];

      const report = await getAccountReport({ from: thirtyDaysAgoStr, to: todayStr });
      const totalSpend = report.reduce((sum, r) => sum + r.cost, 0);
      const totalClicks = report.reduce((sum, r) => sum + r.clicks, 0);
      const totalImpressions = report.reduce((sum, r) => sum + r.impressions, 0);

      const regsFromAds = await prisma.user.count({
        where: { source: 'adwords', createdAt: { gte: monthAgo } },
      });

      const prosFromAds = await prisma.user.count({
        where: { source: 'adwords', plan: 'PRO' },
      });

      const adsRevenue = prosFromAds * 15;

      adsData = {
        spend: Math.round(totalSpend * 100) / 100,
        clicks: totalClicks,
        impressions: totalImpressions,
        regsFromAds,
        prosFromAds,
        cpr: regsFromAds > 0 ? Math.round((totalSpend / regsFromAds) * 100) / 100 : 0,
        cac: prosFromAds > 0 ? Math.round((totalSpend / prosFromAds) * 100) / 100 : 0,
        revenue: adsRevenue,
        roi: totalSpend > 0 ? Math.round((adsRevenue / totalSpend) * 100) : 0,
      };
    } catch (e) {
      console.error('[Dashboard] Google Ads error:', e);
    }

    return NextResponse.json({
      // Tier 1
      mrr: estimatedMRR,
      proCount,
      proCountChange: proCount - proCountWeekAgo,
      signupsToday,
      signupsYesterday,
      signupsWeek,
      newProToday,
      newProYesterday,
      newProWeek,

      // Tier 2
      totalUsers,
      verifiedUsers,
      conversionRate,
      churnRate,
      churned30d,

      // Sources
      signupsBySource: signupsBySource.map(s => ({ source: s.src, count: Number(s.cnt) })),

      // Charts
      dailySignups: dailySignups.map(d => ({
        day: d.day,
        count: Number(d.cnt),
      })),
      dailyRevenue: dailyRevenue.map(d => ({
        day: d.day,
        count: Number(d.cnt),
        amount: d.total ? Math.round(parseFloat(d.total) / 100) : 0,
      })),

      // Funnel today
      funnelToday: Object.fromEntries(funnelToday.map(f => [f.action, Number(f.cnt)])),

      // Activity
      emailsToday,
      emailOpensToday,
      chatToday,

      // Feed
      recentEvents: recentEvents.map(e => ({
        action: e.action,
        details: e.details,
        createdAt: e.createdAt,
        country: e.country,
      })),

      // Google Ads
      ads: adsData,
    });
  } catch (error) {
    console.error('[Dashboard API] Error:', error);
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 });
  }
}
