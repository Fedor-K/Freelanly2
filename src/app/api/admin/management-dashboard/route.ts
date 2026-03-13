import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';
import { getMetrikaLastNDays, testMetrikaConnection } from '@/lib/yandex-metrika-api';
import { getTransactionalStats } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [dbData, trafficData, emailProviderStats] = await Promise.all([
      getDBMetrics(todayStart, sevenDaysAgo, thirtyDaysAgo, now),
      getTrafficSafe(),
      getEmailProviderStatsSafe(),
    ]);

    // Funnel conversions
    const regToVerified = dbData.registrations30d > 0
      ? parseFloat(((dbData.verifiedEmails30d / dbData.registrations30d) * 100).toFixed(1))
      : 0;
    const verifiedToPaywall = dbData.verifiedEmails30d > 0
      ? parseFloat(((dbData.paywallHits30d / dbData.verifiedEmails30d) * 100).toFixed(1))
      : 0;
    const paywallToPro = dbData.paywallHits30d > 0
      ? parseFloat(((dbData.newPro30d / dbData.paywallHits30d) * 100).toFixed(1))
      : 0;

    // Email rates from provider stats
    const alertsSent7d = dbData.alertsSent7d;
    const openRate7d = alertsSent7d > 0
      ? parseFloat(((emailProviderStats.opened / Math.max(alertsSent7d, 1)) * 100).toFixed(1))
      : 0;
    const clickRate7d = alertsSent7d > 0
      ? parseFloat(((emailProviderStats.clicked / Math.max(alertsSent7d, 1)) * 100).toFixed(1))
      : 0;

    // MRR from DB: count active PRO subscriptions and estimate
    // Using actual subscription data from User model
    const mrrEstimate = await estimateMRRFromDB(now);

    return NextResponse.json({
      success: true,
      funnel: {
        visitors30d: trafficData,
        registrations30d: dbData.registrations30d,
        verifiedEmails30d: dbData.verifiedEmails30d,
        paywallHits30d: dbData.paywallHits30d,
        newPro30d: dbData.newPro30d,
        regToVerified,
        verifiedToPaywall,
        paywallToPro,
      },
      today: {
        registrations: dbData.registrationsToday,
        newPro: dbData.newProToday,
        paywallHits: dbData.paywallHitsToday,
        newOpportunities: dbData.newOpportunitiesToday,
      },
      revenue: {
        mrr: mrrEstimate.mrr,
        totalProUsers: mrrEstimate.totalPro,
        churnedLast30d: dbData.churnedLast30d,
      },
      emails: {
        alertsSentLast7d: alertsSent7d,
        openRate7d,
        clickRate7d,
      },
      content: {
        activeOpportunities: dbData.activeOpportunities,
        opportunitiesLast7d: dbData.opportunitiesLast7d,
        activeAlerts: dbData.activeAlerts,
      },
    });
  } catch (error) {
    console.error('[ManagementDashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: String(error) },
      { status: 500 }
    );
  }
}

async function getDBMetrics(
  todayStart: Date,
  sevenDaysAgo: Date,
  thirtyDaysAgo: Date,
  now: Date,
) {
  const [
    registrations30d,
    verifiedEmails30d,
    paywallHits30d,
    newPro30d,
    registrationsToday,
    newProToday,
    paywallHitsToday,
    newOpportunitiesToday,
    churnedLast30d,
    alertsSent7d,
    activeOpportunities,
    opportunitiesLast7d,
    activeAlerts,
  ] = await Promise.all([
    // 30-day funnel
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { emailVerified: { not: null }, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.applyAttempt.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
    }).then(r => r.length),
    prisma.user.count({
      where: {
        plan: 'PRO',
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    // Today
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({
      where: {
        plan: 'PRO',
        createdAt: { gte: todayStart },
      },
    }),
    prisma.applyAttempt.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.opportunity.count({ where: { createdAt: { gte: todayStart } } }),
    // Churned: subscriptionEndsAt passed in last 30 days and plan is FREE
    prisma.user.count({
      where: {
        plan: 'FREE',
        subscriptionEndsAt: { gte: thirtyDaysAgo, lte: now },
      },
    }),
    // Alert emails sent last 7 days
    prisma.alertNotification.count({
      where: { status: 'SENT', sentAt: { gte: sevenDaysAgo } },
    }),
    // Content
    prisma.opportunity.count({ where: { isActive: true } }),
    prisma.opportunity.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.jobAlert.count({ where: { isActive: true } }),
  ]);

  return {
    registrations30d,
    verifiedEmails30d,
    paywallHits30d,
    newPro30d,
    registrationsToday,
    newProToday,
    paywallHitsToday,
    newOpportunitiesToday,
    churnedLast30d,
    alertsSent7d,
    activeOpportunities,
    opportunitiesLast7d,
    activeAlerts,
  };
}

async function getTrafficSafe(): Promise<number | null> {
  try {
    const isConnected = await testMetrikaConnection();
    if (!isConnected) return null;
    const stats = await getMetrikaLastNDays(30);
    return stats.visitors;
  } catch {
    return null;
  }
}

async function getEmailProviderStatsSafe() {
  try {
    const stats = await getTransactionalStats(7);
    return { opened: stats.opened || 0, clicked: stats.clicked || 0 };
  } catch {
    return { opened: 0, clicked: 0 };
  }
}

async function estimateMRRFromDB(now: Date) {
  // Count active PRO users with valid subscriptions
  const totalPro = await prisma.user.count({
    where: {
      plan: { in: ['PRO', 'ENTERPRISE'] },
      subscriptionEndsAt: { gt: now },
    },
  });

  // Average €18/month per PRO user (mix of monthly/quarterly/annual)
  const mrr = totalPro * 18;

  return { mrr, totalPro };
}
