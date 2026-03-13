import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [hotLeads, channels, buyerProfile, quick, goal] = await Promise.all([
      getHotLeads(),
      getChannels(thirtyDaysAgo),
      getBuyerProfile(),
      getQuickMetrics(thirtyDaysAgo),
      getGoalMetrics(thirtyDaysAgo),
    ]);

    return NextResponse.json({
      success: true,
      hotLeads,
      channels,
      buyerProfile,
      quick,
      goal,
    });
  } catch (error) {
    console.error('[ManagementDashboard] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data', details: String(error) },
      { status: 500 }
    );
  }
}

// BLOCK 1: Hot leads — FREE users stuck at paywall with 2+ hits
async function getHotLeads() {
  const results = await prisma.$queryRaw<Array<{
    userId: string;
    email: string;
    paywallHits: bigint;
    lastHitAt: Date;
    createdAt: Date;
    category: string | null;
    source: string | null;
  }>>`
    SELECT
      u.id as "userId",
      u.email,
      COUNT(a.id) as "paywallHits",
      MAX(a."createdAt") as "lastHitAt",
      u."createdAt",
      (SELECT ja.category FROM "JobAlert" ja WHERE ja."userId" = u.id AND ja."isActive" = true LIMIT 1) as category,
      u.source
    FROM "User" u
    JOIN "ApplyAttempt" a ON a."userId" = u.id
    WHERE u.plan = 'FREE'
    GROUP BY u.id, u.email, u."createdAt", u.source
    HAVING COUNT(a.id) >= 2
    ORDER BY COUNT(a.id) DESC
    LIMIT 20
  `;

  const now = new Date();
  return results.map(r => ({
    userId: r.userId,
    email: r.email,
    paywallHits: Number(r.paywallHits),
    lastHitDaysAgo: Math.floor((now.getTime() - new Date(r.lastHitAt).getTime()) / (1000 * 60 * 60 * 24)),
    registeredDaysAgo: Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
    category: r.category || null,
    source: r.source || null,
  }));
}

// BLOCK 2: Conversion by channels
async function getChannels(thirtyDaysAgo: Date) {
  // All users grouped by source
  const allBySource = await prisma.$queryRaw<Array<{
    source: string | null;
    registered: bigint;
  }>>`
    SELECT source, COUNT(*) as registered
    FROM "User"
    GROUP BY source
  `;

  // Users who hit paywall grouped by source
  const paywallBySource = await prisma.$queryRaw<Array<{
    source: string | null;
    hitPaywall: bigint;
  }>>`
    SELECT u.source, COUNT(DISTINCT u.id) as "hitPaywall"
    FROM "User" u
    JOIN "ApplyAttempt" a ON a."userId" = u.id
    GROUP BY u.source
  `;

  // Users who converted to PRO grouped by source
  const proBySource = await prisma.$queryRaw<Array<{
    source: string | null;
    converted: bigint;
  }>>`
    SELECT source, COUNT(*) as converted
    FROM "User"
    WHERE plan = 'PRO'
    GROUP BY source
  `;

  // Merge into single structure
  const sourceMap = new Map<string, { registered: number; hitPaywall: number; converted: number }>();

  for (const row of allBySource) {
    const key = row.source || 'unknown';
    sourceMap.set(key, { registered: Number(row.registered), hitPaywall: 0, converted: 0 });
  }
  for (const row of paywallBySource) {
    const key = row.source || 'unknown';
    const entry = sourceMap.get(key) || { registered: 0, hitPaywall: 0, converted: 0 };
    entry.hitPaywall = Number(row.hitPaywall);
    sourceMap.set(key, entry);
  }
  for (const row of proBySource) {
    const key = row.source || 'unknown';
    const entry = sourceMap.get(key) || { registered: 0, hitPaywall: 0, converted: 0 };
    entry.converted = Number(row.converted);
    sourceMap.set(key, entry);
  }

  return Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      registered: data.registered,
      hitPaywall: data.hitPaywall,
      converted: data.converted,
      conversionRate: data.hitPaywall > 0
        ? parseFloat(((data.converted / data.hitPaywall) * 100).toFixed(1))
        : 0,
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate);
}

// BLOCK 3: Buyer profile from PRO users
async function getBuyerProfile() {
  // Average paywall hits before buying (PRO users who have ApplyAttempts)
  const avgHits = await prisma.$queryRaw<Array<{ avg: number | null }>>`
    SELECT AVG(cnt)::float as avg FROM (
      SELECT COUNT(a.id) as cnt
      FROM "User" u
      JOIN "ApplyAttempt" a ON a."userId" = u.id
      WHERE u.plan = 'PRO'
      GROUP BY u.id
    ) sub
  `;

  // Top categories of PRO users (from their alerts)
  const topCategories = await prisma.$queryRaw<Array<{ category: string; count: bigint }>>`
    SELECT ja.category, COUNT(DISTINCT u.id) as count
    FROM "User" u
    JOIN "JobAlert" ja ON ja."userId" = u.id
    WHERE u.plan = 'PRO' AND ja.category IS NOT NULL
    GROUP BY ja.category
    ORDER BY count DESC
    LIMIT 5
  `;

  // Top sources of PRO users
  const topSources = await prisma.$queryRaw<Array<{ source: string | null; count: bigint }>>`
    SELECT source, COUNT(*) as count
    FROM "User"
    WHERE plan = 'PRO'
    GROUP BY source
    ORDER BY count DESC
    LIMIT 5
  `;

  // Days to convert: difference between proStartedAt and createdAt
  const daysToConvert = await prisma.$queryRaw<Array<{ days: number }>>`
    SELECT EXTRACT(EPOCH FROM ("proStartedAt" - "createdAt")) / 86400.0 as days
    FROM "User"
    WHERE plan = 'PRO' AND "proStartedAt" IS NOT NULL
  `;

  let avgDaysToConvert = 0;
  let medianDaysToConvert = 0;

  if (daysToConvert.length > 0) {
    const dayValues = daysToConvert.map(d => Math.max(0, Math.round(Number(d.days)))).sort((a, b) => a - b);
    avgDaysToConvert = Math.round(dayValues.reduce((sum, v) => sum + v, 0) / dayValues.length);
    const mid = Math.floor(dayValues.length / 2);
    medianDaysToConvert = dayValues.length % 2 === 0
      ? Math.round((dayValues[mid - 1] + dayValues[mid]) / 2)
      : dayValues[mid];
  }

  return {
    avgPaywallHitsBeforeBuy: avgHits[0]?.avg ? parseFloat(avgHits[0].avg.toFixed(1)) : 0,
    topCategories: topCategories.map(r => ({ category: r.category, count: Number(r.count) })),
    topSources: topSources.map(r => ({ source: r.source || 'unknown', count: Number(r.count) })),
    avgDaysToConvert,
    medianDaysToConvert,
  };
}

// BLOCK: Goal — €10k MRR target
async function getGoalMetrics(thirtyDaysAgo: Date) {
  const TARGET_MRR = 10000;
  const TARGET_DATE = new Date('2026-12-31');
  const MONTHLY_VISITORS = 20000; // hardcoded from Metrika
  const TARGET_REG_TO_PRO_RATE = 3.5;

  const now = new Date();
  const daysRemaining = Math.max(0, Math.ceil((TARGET_DATE.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const monthsRemaining = Math.max(0, Math.ceil(daysRemaining / 30.44));

  // Calculate MRR from active PRO users' checkout sessions
  const mrrByPlan = await prisma.$queryRaw<Array<{ priceKey: string; count: bigint }>>`
    SELECT cs."priceKey", COUNT(DISTINCT u.id) as count
    FROM "User" u
    JOIN "CheckoutSession" cs ON cs.email = u.email AND cs.status = 'COMPLETED'
    WHERE u.plan = 'PRO'
    AND cs.id = (
      SELECT cs2.id FROM "CheckoutSession" cs2
      WHERE cs2.email = u.email AND cs2.status = 'COMPLETED'
      ORDER BY cs2."completedAt" DESC NULLS LAST, cs2."createdAt" DESC
      LIMIT 1
    )
    GROUP BY cs."priceKey"
  `;

  const MRR_PER_PLAN: Record<string, number> = {
    monthly: 15,
    quarterly: 35 / 3,
    annual: 150 / 12,
  };

  let currentMRR = 0;
  let matchedUsers = 0;
  for (const row of mrrByPlan) {
    const count = Number(row.count);
    matchedUsers += count;
    currentMRR += count * (MRR_PER_PLAN[row.priceKey] || 15);
  }

  // Fallback: PRO users without checkout sessions → assume €15/mo
  const totalPro = await prisma.user.count({ where: { plan: 'PRO' } });
  const unmatchedPro = totalPro - matchedUsers;
  if (unmatchedPro > 0) {
    currentMRR += unmatchedPro * 15;
  }
  currentMRR = Math.round(currentMRR);

  // Funnel metrics
  const [monthlyRegistrations, monthlyNewPro] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { plan: 'PRO', proStartedAt: { gte: thirtyDaysAgo } } }),
  ]);

  const regToProRate = monthlyRegistrations > 0
    ? parseFloat(((monthlyNewPro / monthlyRegistrations) * 100).toFixed(2))
    : 0;

  // Required growth
  const mrrGap = TARGET_MRR - currentMRR;
  const newProPerMonthNeeded = monthsRemaining > 0
    ? Math.ceil(mrrGap / 15 / monthsRemaining)
    : 0;
  const growthNeeded = monthlyNewPro > 0
    ? parseFloat((newProPerMonthNeeded / monthlyNewPro).toFixed(1))
    : 0;

  return {
    targetMRR: TARGET_MRR,
    currentMRR,
    progressPercent: parseFloat(((currentMRR / TARGET_MRR) * 100).toFixed(1)),
    targetDate: '2026-12-31',
    daysRemaining,
    monthsRemaining,

    funnel: {
      monthlyVisitors: MONTHLY_VISITORS,
      monthlyRegistrations,
      monthlyNewPro,
      regToProRate,
      targetRegToProRate: TARGET_REG_TO_PRO_RATE,
    },

    required: {
      newProPerMonth: newProPerMonthNeeded,
      currentNewProPerMonth: monthlyNewPro,
      growthNeeded,
    },

    totalPro,

    roadmap: [
      { month: 'Апрель', action: 'Исправить nurture/reengagement письма, fix paywall UX', targetPro: 90, targetMRR: 1350 },
      { month: 'Май', action: 'A/B тест оффера, email после пейволл-хита', targetPro: 150, targetMRR: 2250 },
      { month: 'Июнь', action: 'SEO рост (контент по категориям), LinkedIn органика', targetPro: 230, targetMRR: 3450 },
      { month: 'Июль-Авг', action: 'Scale Google Ads если CAC окупается', targetPro: 350, targetMRR: 5250 },
      { month: 'Сент-Окт', action: 'Реферальная программа, партнёрства', targetPro: 500, targetMRR: 7500 },
      { month: 'Ноябрь', action: 'Retention, upsell annual', targetPro: 620, targetMRR: 9300 },
      { month: 'Декабрь', action: 'Цель достигнута', targetPro: 667, targetMRR: 10000 },
    ],
  };
}

// Quick metrics
async function getQuickMetrics(thirtyDaysAgo: Date) {
  const [totalPro, newProLast30d, freeWithPaywall] = await Promise.all([
    // All PRO users — no extra conditions (PayPal users may not have subscriptionEndsAt)
    prisma.user.count({ where: { plan: 'PRO' } }),

    // New PRO in last 30 days
    prisma.user.count({
      where: { plan: 'PRO', proStartedAt: { gte: thirtyDaysAgo } },
    }),

    // FREE users who hit paywall but didn't buy
    prisma.$queryRaw<Array<{ count: bigint; avgHits: number | null }>>`
      SELECT
        COUNT(DISTINCT u.id) as count,
        AVG(cnt)::float as "avgHits"
      FROM (
        SELECT u.id, COUNT(a.id) as cnt
        FROM "User" u
        JOIN "ApplyAttempt" a ON a."userId" = u.id
        WHERE u.plan = 'FREE'
        GROUP BY u.id
      ) sub
      JOIN "User" u ON u.id = sub.id
    `,
  ]);

  const freeData = freeWithPaywall[0] || { count: BigInt(0), avgHits: null };

  return {
    totalPro,
    newProLast30d,
    mrrEstimate: totalPro * 18,
    freeUsersWithPaywallHit: Number(freeData.count),
    avgPaywallHitsPerFreeUser: freeData.avgHits ? parseFloat(freeData.avgHits.toFixed(1)) : 0,
  };
}
