/**
 * Analytics Collector Service
 *
 * Единый центр сбора данных из всех источников:
 * - Яндекс.Метрика (трафик, поведение)
 * - DashaMail (email статистика)
 * - Google Sheets (ручные данные)
 * - Internal DB (продуктовые метрики)
 */

import { prisma } from '@/lib/db';
import { getMetrikaLastNDays, testMetrikaConnection, type MetrikaStats } from '@/lib/yandex-metrika-api';
import { getEmailMarketingStats, testDashaMailConnection, type SubscriberStats, type EmailCampaignStats } from '@/lib/dashamail';
import { fetchAnalyticsFromSheet, getAnalyticsSheetId, type AnalyticsData } from '@/lib/google-sheets';

// ============================================
// TYPES
// ============================================

export interface FullAnalyticsReport {
  generatedAt: Date;

  // Connection status
  connections: {
    yandexMetrika: boolean;
    dashaMail: boolean;
    googleSheets: boolean;
    database: boolean;
  };

  // Traffic (from Yandex.Metrika)
  traffic: MetrikaStats | null;

  // Email (from DashaMail)
  email: {
    subscribers: SubscriberStats | null;
    lastCampaigns: EmailCampaignStats[];
    avgOpenRate: number;
    avgClickRate: number;
  } | null;

  // Manual data (from Google Sheets)
  manualData: AnalyticsData | null;

  // Internal metrics (from DB)
  internal: {
    totalJobs: number;
    activeJobs: number;
    totalCompanies: number;
    totalUsers: number;
    paidUsers: number;
    jobAlertSubscribers: number;
    applicationsThisMonth: number;
  };

  // Calculated KPIs
  kpis: {
    currentMRR: number;
    conversionRate: number;
    emailEngagementScore: number;
    trafficGrowth: number | null;
    contentFreshness: number; // % jobs updated in last 7 days
  };

  // Alerts and recommendations
  alerts: string[];
  recommendations: string[];
}

// ============================================
// DATA COLLECTORS
// ============================================

/**
 * Собирает данные из Яндекс.Метрики
 */
async function collectMetrikaData(): Promise<MetrikaStats | null> {
  try {
    const connected = await testMetrikaConnection();
    if (!connected) return null;

    return await getMetrikaLastNDays(30);
  } catch (error) {
    console.error('Failed to collect Metrika data:', error);
    return null;
  }
}

/**
 * Собирает данные из DashaMail
 */
async function collectEmailData() {
  try {
    const connected = await testDashaMailConnection();
    if (!connected) return null;

    return await getEmailMarketingStats();
  } catch (error) {
    console.error('Failed to collect email data:', error);
    return null;
  }
}

/**
 * Собирает данные из Google Sheets
 */
async function collectSheetData(): Promise<AnalyticsData | null> {
  try {
    const sheetId = await getAnalyticsSheetId();
    if (!sheetId) return null;

    return await fetchAnalyticsFromSheet(sheetId);
  } catch (error) {
    console.error('Failed to collect sheet data:', error);
    return null;
  }
}

/**
 * Собирает внутренние метрики из базы данных
 */
async function collectInternalData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalJobs,
    activeJobs,
    recentJobs,
    totalCompanies,
    totalUsers,
    paidUsers,
    jobAlerts,
    applications,
  ] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { isActive: true } }),
    prisma.job.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
    prisma.company.count(),
    prisma.user.count(),
    prisma.user.count({ where: { plan: { not: 'FREE' } } }),
    prisma.jobAlert.count({ where: { isActive: true } }),
    prisma.application.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
  ]);

  return {
    totalJobs,
    activeJobs,
    totalCompanies,
    totalUsers,
    paidUsers,
    jobAlertSubscribers: jobAlerts,
    applicationsThisMonth: applications,
    contentFreshness: activeJobs > 0 ? (recentJobs / activeJobs) * 100 : 0,
  };
}

// ============================================
// KPI CALCULATIONS
// ============================================

function calculateKPIs(
  internal: Awaited<ReturnType<typeof collectInternalData>>,
  email: Awaited<ReturnType<typeof collectEmailData>>,
  traffic: MetrikaStats | null
) {
  // MRR calculation (Pro = $19, Enterprise = $99)
  // Without actual Stripe data, estimate based on paid users
  const currentMRR = internal.paidUsers * 1900; // cents

  // Conversion rate
  const conversionRate = internal.totalUsers > 0
    ? (internal.paidUsers / internal.totalUsers) * 100
    : 0;

  // Email engagement score (0-100)
  let emailEngagementScore = 0;
  if (email) {
    const openRateScore = Math.min(email.avgOpenRate / 30 * 50, 50); // 30% open = 50 points
    const clickRateScore = Math.min(email.avgClickRate / 5 * 50, 50); // 5% click = 50 points
    emailEngagementScore = openRateScore + clickRateScore;
  }

  return {
    currentMRR,
    conversionRate,
    emailEngagementScore,
    trafficGrowth: null, // Need historical data to calculate
    contentFreshness: internal.contentFreshness,
  };
}

// ============================================
// ALERTS & RECOMMENDATIONS
// ============================================

function generateAlerts(
  internal: Awaited<ReturnType<typeof collectInternalData>>,
  email: Awaited<ReturnType<typeof collectEmailData>>,
  traffic: MetrikaStats | null,
  kpis: ReturnType<typeof calculateKPIs>
): string[] {
  const alerts: string[] = [];

  // Critical alerts
  if (internal.paidUsers === 0) {
    alerts.push('🚨 CRITICAL: No paid users yet. Payment system needs to be launched.');
  }

  if (internal.activeJobs < 100) {
    alerts.push('⚠️ Low job count. Need more content sources.');
  }

  if (kpis.contentFreshness < 50) {
    alerts.push('⚠️ Content freshness below 50%. Jobs may appear stale to users.');
  }

  if (email && email.avgOpenRate < 15) {
    alerts.push('⚠️ Email open rate below 15%. Review subject lines and sending time.');
  }

  if (traffic && traffic.bounceRate > 70) {
    alerts.push('⚠️ High bounce rate (>70%). Check landing page relevance.');
  }

  return alerts;
}

function generateRecommendations(
  internal: Awaited<ReturnType<typeof collectInternalData>>,
  connections: FullAnalyticsReport['connections'],
  kpis: ReturnType<typeof calculateKPIs>
): string[] {
  const recommendations: string[] = [];

  // Connection recommendations
  if (!connections.yandexMetrika) {
    recommendations.push('📊 Connect Yandex.Metrika for traffic insights');
  }

  if (!connections.googleSheets) {
    recommendations.push('📋 Set up Google Sheets for manual metrics tracking');
  }

  // Growth recommendations
  if (kpis.currentMRR === 0) {
    recommendations.push('💰 Priority #1: Implement authentication and Stripe payments');
  }

  if (internal.jobAlertSubscribers < 100) {
    recommendations.push('📧 Focus on growing email list. Add more signup CTAs.');
  }

  if (kpis.conversionRate < 2) {
    recommendations.push('📈 Conversion rate is low. Test pricing and value proposition.');
  }

  if (internal.activeJobs < 500) {
    recommendations.push('📋 Add more job sources to increase content value.');
  }

  return recommendations;
}

// ============================================
// MAIN COLLECTOR
// ============================================

/**
 * Собирает полный отчёт аналитики из всех источников
 */
export async function collectFullAnalytics(): Promise<FullAnalyticsReport> {
  // Parallel data collection
  const [traffic, email, manualData, internal] = await Promise.all([
    collectMetrikaData(),
    collectEmailData(),
    collectSheetData(),
    collectInternalData(),
  ]);

  // Check connections
  const connections = {
    yandexMetrika: traffic !== null,
    dashaMail: email !== null,
    googleSheets: manualData !== null,
    database: true, // If we got here, DB is working
  };

  // Calculate KPIs
  const kpis = calculateKPIs(internal, email, traffic);

  // Generate alerts and recommendations
  const alerts = generateAlerts(internal, email, traffic, kpis);
  const recommendations = generateRecommendations(internal, connections, kpis);

  return {
    generatedAt: new Date(),
    connections,
    traffic,
    email,
    manualData,
    internal: {
      totalJobs: internal.totalJobs,
      activeJobs: internal.activeJobs,
      totalCompanies: internal.totalCompanies,
      totalUsers: internal.totalUsers,
      paidUsers: internal.paidUsers,
      jobAlertSubscribers: internal.jobAlertSubscribers,
      applicationsThisMonth: internal.applicationsThisMonth,
    },
    kpis,
    alerts,
    recommendations,
  };
}

/**
 * Сохраняет ежедневные метрики в базу
 */
export async function saveDailyMetrics(): Promise<void> {
  const report = await collectFullAnalytics();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailyMetric.upsert({
    where: { date: today },
    create: {
      date: today,
      // Traffic
      pageViews: report.traffic?.pageviews || 0,
      uniqueVisitors: report.traffic?.visitors || 0,
      // Users
      newSignups: 0, // Need to calculate from yesterday
      // Content
      newJobs: 0, // Need to calculate from yesterday
      newCompanies: 0,
      // Email
      emailAlertSubs: report.internal.jobAlertSubscribers,
      // Revenue
      netMRR: report.kpis.currentMRR,
    },
    update: {
      pageViews: report.traffic?.pageviews || 0,
      uniqueVisitors: report.traffic?.visitors || 0,
      emailAlertSubs: report.internal.jobAlertSubscribers,
      netMRR: report.kpis.currentMRR,
    },
  });
}

// ============================================
// EXPORTS
// ============================================

export const analyticsCollector = {
  collectFull: collectFullAnalytics,
  saveDailyMetrics,
  collectMetrika: collectMetrikaData,
  collectEmail: collectEmailData,
  collectSheet: collectSheetData,
  collectInternal: collectInternalData,
};
