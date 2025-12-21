/**
 * CEO Analytics Service
 *
 * Центральный сервис для сбора, агрегации и анализа бизнес-метрик.
 * Используется для принятия решений на уровне CEO.
 */

import { prisma } from '@/lib/db';
import { AlertSeverity, AlertType, Plan, Prisma, RevenueEventType } from '@prisma/client';

// ============================================
// TYPES
// ============================================

export interface CEODashboardData {
  // Current state
  currentMRR: number;
  targetMRR: number;
  mrrProgress: number; // percentage to goal

  // Key metrics
  totalUsers: number;
  paidUsers: number;
  freeUsers: number;
  conversionRate: number;

  // Content
  totalJobs: number;
  activeJobs: number;
  totalCompanies: number;

  // Growth (vs previous period)
  mrrGrowth: number;
  userGrowth: number;
  jobGrowth: number;

  // Health indicators
  churnRate: number;
  avgRevenuePerUser: number;
  customerLifetimeValue: number;

  // Trends (last 30 days)
  dailyMetrics: DailyMetricSummary[];

  // Alerts
  alerts: CEOAlertData[];

  // Monthly targets
  monthlyProgress: MonthlyProgressData;
}

export interface DailyMetricSummary {
  date: string;
  mrr: number;
  signups: number;
  conversions: number;
  churns: number;
  jobs: number;
  pageViews: number;
}

export interface CEOAlertData {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  createdAt: Date;
  isRead: boolean;
}

export interface MonthlyProgressData {
  month: string;
  targetMRR: number;
  currentMRR: number;
  targetSignups: number;
  currentSignups: number;
  targetPaidUsers: number;
  currentPaidUsers: number;
  daysRemaining: number;
  onTrack: boolean;
}

// ============================================
// CORE METRICS FUNCTIONS
// ============================================

/**
 * Рассчитывает текущий MRR на основе активных подписок
 */
export async function calculateCurrentMRR(): Promise<number> {
  // Пока нет реальных подписок, возвращаем 0
  // После интеграции Stripe это будет реальный расчёт
  const paidUsers = await prisma.user.count({
    where: { plan: { not: 'FREE' } },
  });

  // Pro = $19/mo = 1900 cents
  // Enterprise = $99/mo = 9900 cents (assumed)
  const proUsers = await prisma.user.count({
    where: { plan: 'PRO' },
  });

  const enterpriseUsers = await prisma.user.count({
    where: { plan: 'ENTERPRISE' },
  });

  return proUsers * 1900 + enterpriseUsers * 9900;
}

/**
 * Получает полные данные для CEO dashboard
 */
export async function getCEODashboardData(): Promise<CEODashboardData> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Параллельные запросы для производительности
  const [
    currentMRR,
    totalUsers,
    paidUsers,
    totalJobs,
    activeJobs,
    totalCompanies,
    dailyMetrics,
    alerts,
    monthlyTarget,
    previousMonthMRR,
    previousMonthUsers,
  ] = await Promise.all([
    calculateCurrentMRR(),
    prisma.user.count(),
    prisma.user.count({ where: { plan: { not: 'FREE' } } }),
    prisma.job.count(),
    prisma.job.count({ where: { isActive: true } }),
    prisma.company.count(),
    prisma.dailyMetric.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      orderBy: { date: 'asc' },
    }),
    prisma.cEOAlert.findMany({
      where: { isDismissed: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.monthlyTarget.findFirst({
      where: { month: startOfMonth },
    }),
    // Previous month MRR (from daily metrics)
    prisma.dailyMetric.findFirst({
      where: {
        date: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
          lt: startOfMonth,
        },
      },
      orderBy: { date: 'desc' },
    }),
    // Previous month users
    prisma.user.count({
      where: { createdAt: { lt: startOfMonth } },
    }),
  ]);

  // Расчёт производных метрик
  const freeUsers = totalUsers - paidUsers;
  const conversionRate = totalUsers > 0 ? (paidUsers / totalUsers) * 100 : 0;

  // Target MRR: $10,000 = 1,000,000 cents к маю 2026
  const targetMRR = 1000000; // $10,000 in cents
  const mrrProgress = (currentMRR / targetMRR) * 100;

  // Рост метрик
  const prevMRR = previousMonthMRR?.netMRR || 0;
  const mrrGrowth = prevMRR > 0 ? ((currentMRR - prevMRR) / prevMRR) * 100 : 0;

  const userGrowth =
    previousMonthUsers > 0 ? ((totalUsers - previousMonthUsers) / previousMonthUsers) * 100 : 0;

  // Churn rate (последние 30 дней)
  const churnsLast30Days = dailyMetrics.reduce((sum, d) => sum + d.churns, 0);
  const churnRate = paidUsers > 0 ? (churnsLast30Days / paidUsers) * 100 : 0;

  // ARPU и LTV
  const avgRevenuePerUser = paidUsers > 0 ? currentMRR / paidUsers : 0;
  const customerLifetimeValue = churnRate > 0 ? avgRevenuePerUser / (churnRate / 100) : 0;

  // Дни до конца месяца
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const daysRemaining = Math.ceil(
    (endOfMonth.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Monthly progress
  const monthlyProgress: MonthlyProgressData = {
    month: startOfMonth.toISOString().slice(0, 7),
    targetMRR: monthlyTarget?.targetMRR || 100000, // $1000 default
    currentMRR,
    targetSignups: monthlyTarget?.targetSignups || 100,
    currentSignups: dailyMetrics
      .filter((d) => d.date >= startOfMonth)
      .reduce((sum, d) => sum + d.newSignups, 0),
    targetPaidUsers: monthlyTarget?.targetPaidUsers || 10,
    currentPaidUsers: paidUsers,
    daysRemaining,
    onTrack: currentMRR >= (monthlyTarget?.targetMRR || 0) * (1 - daysRemaining / 30),
  };

  // Формируем daily summaries
  const dailySummaries: DailyMetricSummary[] = dailyMetrics.map((d) => ({
    date: d.date.toISOString().slice(0, 10),
    mrr: d.netMRR,
    signups: d.newSignups,
    conversions: d.paidConversions,
    churns: d.churns,
    jobs: d.newJobs,
    pageViews: d.pageViews,
  }));

  // New jobs growth
  const jobsThisMonth = dailyMetrics
    .filter((d) => d.date >= startOfMonth)
    .reduce((sum, d) => sum + d.newJobs, 0);
  const jobsLastMonth = dailyMetrics
    .filter((d) => d.date < startOfMonth)
    .reduce((sum, d) => sum + d.newJobs, 0);
  const jobGrowth = jobsLastMonth > 0 ? ((jobsThisMonth - jobsLastMonth) / jobsLastMonth) * 100 : 0;

  return {
    currentMRR,
    targetMRR,
    mrrProgress,
    totalUsers,
    paidUsers,
    freeUsers,
    conversionRate,
    totalJobs,
    activeJobs,
    totalCompanies,
    mrrGrowth,
    userGrowth,
    jobGrowth,
    churnRate,
    avgRevenuePerUser,
    customerLifetimeValue,
    dailyMetrics: dailySummaries,
    alerts: alerts.map((a) => ({
      id: a.id,
      type: a.type,
      severity: a.severity,
      title: a.title,
      message: a.message,
      createdAt: a.createdAt,
      isRead: a.isRead,
    })),
    monthlyProgress,
  };
}

// ============================================
// METRIC RECORDING
// ============================================

/**
 * Записывает ежедневные метрики (вызывается cron job)
 */
export async function recordDailyMetrics(): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  // Собираем метрики
  const [newJobs, expiredJobs, newCompanies, newSignups, importLogs, currentMRR] =
    await Promise.all([
      prisma.job.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      prisma.job.count({
        where: {
          isActive: false,
          updatedAt: { gte: yesterday, lt: today },
        },
      }),
      prisma.company.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: yesterday, lt: today } },
      }),
      prisma.importLog.findMany({
        where: { startedAt: { gte: yesterday, lt: today } },
      }),
      calculateCurrentMRR(),
    ]);

  const importRuns = importLogs.length;
  const importSuccesses = importLogs.filter((l) => l.status === 'COMPLETED').length;
  const importFailures = importLogs.filter((l) => l.status === 'FAILED').length;

  // Upsert daily metric
  await prisma.dailyMetric.upsert({
    where: { date: yesterday },
    create: {
      date: yesterday,
      newJobs,
      expiredJobs,
      newCompanies,
      newSignups,
      importRuns,
      importSuccesses,
      importFailures,
      netMRR: currentMRR,
    },
    update: {
      newJobs,
      expiredJobs,
      newCompanies,
      newSignups,
      importRuns,
      importSuccesses,
      importFailures,
      netMRR: currentMRR,
    },
  });

  // Проверяем алерты
  await checkAndCreateAlerts(currentMRR, newSignups);
}

/**
 * Записывает событие revenue
 */
export async function recordRevenueEvent(
  type: RevenueEventType,
  amount: number,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.revenueEvent.create({
    data: {
      type,
      amount,
      userId,
      metadata: (metadata || {}) as Prisma.InputJsonValue,
    },
  });

  // Обновляем daily metric
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (type === 'SUBSCRIPTION_STARTED' || type === 'SUBSCRIPTION_RENEWED') {
    await prisma.dailyMetric.upsert({
      where: { date: today },
      create: {
        date: today,
        newMRR: amount,
        paidConversions: type === 'SUBSCRIPTION_STARTED' ? 1 : 0,
      },
      update: {
        newMRR: { increment: amount },
        paidConversions:
          type === 'SUBSCRIPTION_STARTED' ? { increment: 1 } : undefined,
      },
    });
  } else if (type === 'SUBSCRIPTION_CHURNED' || type === 'SUBSCRIPTION_CANCELLED') {
    await prisma.dailyMetric.upsert({
      where: { date: today },
      create: {
        date: today,
        churnedMRR: amount,
        churns: 1,
      },
      update: {
        churnedMRR: { increment: amount },
        churns: { increment: 1 },
      },
    });
  }
}

// ============================================
// ALERTS SYSTEM
// ============================================

/**
 * Проверяет метрики и создаёт алерты при необходимости
 */
async function checkAndCreateAlerts(
  currentMRR: number,
  newSignups: number
): Promise<void> {
  const alerts: Array<{
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
  }> = [];

  // Проверка прогресса к цели
  const targetMRR = 1000000; // $10,000
  const targetDate = new Date('2026-05-01');
  const now = new Date();
  const totalDays = (targetDate.getTime() - new Date('2024-12-01').getTime()) / (24 * 60 * 60 * 1000);
  const daysElapsed = (now.getTime() - new Date('2024-12-01').getTime()) / (24 * 60 * 60 * 1000);
  const expectedProgress = (daysElapsed / totalDays) * targetMRR;

  if (currentMRR < expectedProgress * 0.8) {
    alerts.push({
      type: 'TARGET_AT_RISK',
      severity: 'WARNING',
      title: 'MRR Target At Risk',
      message: `Current MRR ($${(currentMRR / 100).toFixed(0)}) is ${((1 - currentMRR / expectedProgress) * 100).toFixed(0)}% below expected progress. Action needed.`,
    });
  }

  // Milestone alerts
  const milestones = [10000, 50000, 100000, 250000, 500000, 1000000]; // in cents
  for (const milestone of milestones) {
    const existingAlert = await prisma.cEOAlert.findFirst({
      where: {
        type: 'MILESTONE_REACHED',
        metricName: 'MRR',
        threshold: milestone,
      },
    });

    if (!existingAlert && currentMRR >= milestone) {
      alerts.push({
        type: 'MILESTONE_REACHED',
        severity: 'INFO',
        title: `🎉 MRR Milestone: $${(milestone / 100).toLocaleString()}`,
        message: `Congratulations! You've reached $${(milestone / 100).toLocaleString()} MRR.`,
      });
    }
  }

  // Create alerts
  for (const alert of alerts) {
    await prisma.cEOAlert.create({
      data: alert,
    });
  }
}

/**
 * Создаёт алерт вручную
 */
export async function createCEOAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string
): Promise<void> {
  await prisma.cEOAlert.create({
    data: { type, severity, title, message },
  });
}

/**
 * Помечает алерт как прочитанный
 */
export async function markAlertAsRead(alertId: string): Promise<void> {
  await prisma.cEOAlert.update({
    where: { id: alertId },
    data: { isRead: true },
  });
}

/**
 * Отклоняет алерт
 */
export async function dismissAlert(alertId: string): Promise<void> {
  await prisma.cEOAlert.update({
    where: { id: alertId },
    data: { isDismissed: true },
  });
}

// ============================================
// MONTHLY TARGETS
// ============================================

/**
 * Устанавливает месячные цели
 */
export async function setMonthlyTargets(
  month: Date,
  targets: {
    targetMRR: number;
    targetSignups: number;
    targetPaidUsers: number;
    targetJobs: number;
    notes?: string;
  }
): Promise<void> {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);

  await prisma.monthlyTarget.upsert({
    where: { month: firstOfMonth },
    create: {
      month: firstOfMonth,
      ...targets,
    },
    update: targets,
  });
}

/**
 * Получает рекомендации по действиям на основе данных
 */
export async function getCEORecommendations(): Promise<string[]> {
  const data = await getCEODashboardData();
  const recommendations: string[] = [];

  // Низкая конверсия
  if (data.conversionRate < 2) {
    recommendations.push(
      '📈 Conversion rate is below 2%. Consider: improving onboarding, adding social proof, or adjusting pricing.'
    );
  }

  // Высокий churn
  if (data.churnRate > 5) {
    recommendations.push(
      '⚠️ Churn rate is above 5%. Investigate: user feedback, feature gaps, or support quality.'
    );
  }

  // Мало вакансий
  if (data.activeJobs < 500) {
    recommendations.push(
      '📋 Active jobs below 500. Priority: add more ATS integrations, increase LinkedIn scraping frequency.'
    );
  }

  // Нет платных пользователей
  if (data.paidUsers === 0) {
    recommendations.push(
      '🚨 CRITICAL: No paid users yet. Immediate action: launch Stripe integration and paywall.'
    );
  }

  // Хороший прогресс
  if (data.mrrProgress >= 10) {
    recommendations.push(
      `✅ Good progress! ${data.mrrProgress.toFixed(1)}% towards $10K MRR goal.`
    );
  }

  return recommendations;
}

// ============================================
// EXPORTS
// ============================================

export const ceoAnalytics = {
  getDashboard: getCEODashboardData,
  calculateMRR: calculateCurrentMRR,
  recordDailyMetrics,
  recordRevenueEvent,
  createAlert: createCEOAlert,
  markAlertAsRead,
  dismissAlert,
  setMonthlyTargets,
  getRecommendations: getCEORecommendations,
};
