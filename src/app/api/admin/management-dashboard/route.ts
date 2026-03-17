import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';
import { getMetrikaByPeriod } from '@/lib/yandex-metrika-api';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  try {
    const url = new URL(request.url);
    const period = (url.searchParams.get('period') || 'day') as 'day' | 'week' | 'month';
    const defaultRange = period === 'day' ? 30 : period === 'week' ? 12 : 6;
    const range = parseInt(url.searchParams.get('range') || String(defaultRange), 10);

    const now = new Date();

    // Helper: get start of day in Moscow timezone (UTC+3)
    function moscowStartOfDay(date: Date = new Date()): Date {
      const moscowStr = date.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' }); // YYYY-MM-DD
      const [y, m, d] = moscowStr.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, -3)); // midnight Moscow = 21:00 UTC previous day
    }

    const moscowToday = moscowStartOfDay(now);
    const thirtyDaysAgo = new Date(moscowToday.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Period window for funnel — use calendar boundaries in Moscow timezone
    let periodStart: Date;
    if (period === 'day') {
      periodStart = moscowToday; // start of today in Moscow
    } else if (period === 'week') {
      periodStart = new Date(moscowToday.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else {
      // Start of this month in Moscow
      const moscowStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });
      const [y, m] = moscowStr.split('-').map(Number);
      periodStart = new Date(Date.UTC(y, m - 1, 1, -3)); // 1st of month midnight Moscow
    }

    const [hotLeads, trafficBySource, buyerProfile, quick, goal, trafficChart] = await Promise.all([
      getHotLeads(),
      getMetrikaTrafficBySource(periodStart, now).catch(() => ({} as Record<string, number>)),
      getBuyerProfile(),
      getQuickMetrics(thirtyDaysAgo),
      getGoalMetrics(thirtyDaysAgo, periodStart, period),
      getTrafficChart(period, range),
    ]);

    const channels = getChannelsWithVisitors(await getChannels(periodStart), trafficBySource);

    return NextResponse.json({
      success: true,
      hotLeads,
      channels,
      buyerProfile,
      quick,
      goal,
      trafficChart,
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
async function getChannels(periodStart: Date) {
  // All users grouped by source — filtered by period
  const allBySource = await prisma.$queryRaw<Array<{
    source: string | null;
    registered: bigint;
  }>>`
    SELECT source, COUNT(*) as registered
    FROM "User"
    WHERE "createdAt" >= ${periodStart} AND "emailVerified" IS NOT NULL
    GROUP BY source
  `;

  // Users who hit paywall grouped by source — filtered by period
  const paywallBySource = await prisma.$queryRaw<Array<{
    source: string | null;
    hitPaywall: bigint;
  }>>`
    SELECT u.source, COUNT(DISTINCT u.id) as "hitPaywall"
    FROM "User" u
    JOIN "ApplyAttempt" a ON a."userId" = u.id
    WHERE u."createdAt" >= ${periodStart} AND u."emailVerified" IS NOT NULL
    GROUP BY u.source
  `;

  // Users who converted to PRO grouped by source — filtered by period
  const proBySource = await prisma.$queryRaw<Array<{
    source: string | null;
    converted: bigint;
  }>>`
    SELECT source, COUNT(*) as converted
    FROM "User"
    WHERE plan = 'PRO' AND "createdAt" >= ${periodStart} AND "emailVerified" IS NOT NULL
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

  // Conversion sources — UTM source at moment of purchase
  const conversionSources = await prisma.$queryRaw<Array<{ source: string | null; count: bigint }>>`
    SELECT "conversionSource" as source, COUNT(*) as count
    FROM "User"
    WHERE plan = 'PRO' AND "conversionSource" IS NOT NULL
    GROUP BY "conversionSource"
    ORDER BY count DESC
    LIMIT 10
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
    conversionSources: conversionSources.map(r => ({ source: r.source || 'unknown', count: Number(r.count) })),
    avgDaysToConvert,
    medianDaysToConvert,
  };
}

// BLOCK: Goal — €10k MRR target
async function getGoalMetrics(thirtyDaysAgo: Date, periodStart?: Date, period?: string) {
  const TARGET_MRR = 10000;
  const TARGET_DATE = new Date('2026-12-31');
  const TARGET_REG_TO_PRO_RATE = 3.5;
  const funnelFrom = periodStart || thirtyDaysAgo;
  const periodLabel = period === 'day' ? 'сегодня' : period === 'week' ? 'неделю' : 'месяц';

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

  // Funnel metrics — scoped to selected period
  const [periodRegistrations, periodNewPro, metrikaVisitors] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: funnelFrom }, emailVerified: { not: null } } }),
    prisma.user.count({ where: { plan: 'PRO', proStartedAt: { gte: funnelFrom }, emailVerified: { not: null } } }),
    getMetrikaForDateRange(funnelFrom, new Date()).catch(() => 0),
  ]);

  // Monthly equivalents for "need +X PRO/mo" calc (always 30d)
  const monthlyNewPro = await prisma.user.count({ where: { plan: 'PRO', proStartedAt: { gte: thirtyDaysAgo }, emailVerified: { not: null } } });

  const periodVisitors = metrikaVisitors || 0;
  const regToProRate = periodRegistrations > 0
    ? parseFloat(((periodNewPro / periodRegistrations) * 100).toFixed(2))
    : 0;
  const visitorToRegRate = periodVisitors > 0
    ? parseFloat(((periodRegistrations / periodVisitors) * 100).toFixed(1))
    : null;

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
      periodLabel,
      visitors: periodVisitors,
      registrations: periodRegistrations,
      newPro: periodNewPro,
      regToProRate,
      visitorToRegRate,
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

// BLOCK: Traffic chart — Metrika + DB registrations/newPro
async function getMetrikaForDateRange(from: Date, to: Date): Promise<number> {
  const token = process.env.YANDEX_METRIKA_TOKEN;
  const counterId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
  if (!token || !counterId) return 0;
  const date1 = from.toISOString().slice(0, 10);
  const date2 = to.toISOString().slice(0, 10);
  const url = `https://api-metrika.yandex.net/stat/v1/data?ids=${counterId}&metrics=ym:s:users&date1=${date1}&date2=${date2}`;
  const res = await fetch(url, { headers: { Authorization: `OAuth ${token}` }, cache: 'no-store' });
  if (!res.ok) return 0;
  const data = await res.json();
  return Math.round(data?.totals?.[0] || 0);
}

async function getMetrikaTrafficBySource(from: Date, to: Date): Promise<Record<string, number>> {
  const token = process.env.YANDEX_METRIKA_TOKEN;
  const counterId = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID;
  if (!token || !counterId) return {};
  const date1 = from.toISOString().slice(0, 10);
  const date2 = to.toISOString().slice(0, 10);
  const url = `https://api-metrika.yandex.net/stat/v1/data?ids=${counterId}&metrics=ym:s:users&dimensions=ym:s:trafficSource&date1=${date1}&date2=${date2}`;
  const res = await fetch(url, { headers: { Authorization: `OAuth ${token}` }, cache: 'no-store' });
  if (!res.ok) return {};
  const data = await res.json();

  const SOURCE_MAP: Record<string, string> = {
    'Переходы из поисковых систем': 'organic',
    'Прямые заходы': 'direct',
    'Переходы по рекламе': 'google_ads',
    'Переходы из социальных сетей': 'linkedin',
    'Переходы с других сайтов': 'referral',
  };

  const result: Record<string, number> = {};
  for (const row of data?.data || []) {
    const sourceName = row.dimensions?.[0]?.name || '';
    const key = SOURCE_MAP[sourceName] || 'unknown';
    result[key] = (result[key] || 0) + Math.round(row.metrics?.[0] || 0);
  }
  return result;
}

function getChannelsWithVisitors(
  channels: Array<{ source: string; registered: number; hitPaywall: number; converted: number; conversionRate: number }>,
  trafficBySource: Record<string, number>,
) {
  return channels.map(ch => ({
    ...ch,
    visitors: trafficBySource[ch.source] || 0,
  }));
}

async function getTrafficChart(period: 'day' | 'week' | 'month', range: number) {
  // Calculate date range
  let daysBack: number;
  if (period === 'day') daysBack = range;
  else if (period === 'week') daysBack = range * 7;
  else daysBack = range * 31;

  const fromDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  // Fetch Metrika data and DB data in parallel
  const [metrikaData, dbRegistrations, dbNewPro] = await Promise.all([
    getMetrikaByPeriod(period, range),

    prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, COUNT(*) as count
      FROM "User"
      WHERE "createdAt" >= ${fromDate} AND "emailVerified" IS NOT NULL
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
      ORDER BY date
    `,

    prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
      SELECT TO_CHAR("proStartedAt", 'YYYY-MM-DD') as date, COUNT(*) as count
      FROM "User"
      WHERE plan = 'PRO' AND "proStartedAt" >= ${fromDate} AND "emailVerified" IS NOT NULL
      GROUP BY TO_CHAR("proStartedAt", 'YYYY-MM-DD')
      ORDER BY date
    `,
  ]);

  // Build lookup maps for DB data, grouped by period
  const regMap = new Map<string, number>();
  const proMap = new Map<string, number>();

  for (const row of dbRegistrations) {
    const key = periodKey(row.date, period);
    regMap.set(key, (regMap.get(key) || 0) + Number(row.count));
  }
  for (const row of dbNewPro) {
    const key = periodKey(row.date, period);
    proMap.set(key, (proMap.get(key) || 0) + Number(row.count));
  }

  // If Metrika returned data, merge with DB data
  if (metrikaData.length > 0) {
    // Collect all dates from both sources
    const allDates = new Set<string>();
    for (const m of metrikaData) allDates.add(m.date);
    for (const key of regMap.keys()) allDates.add(key);
    for (const key of proMap.keys()) allDates.add(key);

    const metrikaMap = new Map(metrikaData.map(m => [m.date, m]));

    return Array.from(allDates)
      .sort()
      .map(date => ({
        date,
        visits: metrikaMap.get(date)?.visits || 0,
        visitors: metrikaMap.get(date)?.visitors || 0,
        registrations: regMap.get(date) || 0,
        newPro: proMap.get(date) || 0,
      }));
  }

  // Metrika unavailable — return DB data only
  const allDates = new Set<string>();
  for (const key of regMap.keys()) allDates.add(key);
  for (const key of proMap.keys()) allDates.add(key);

  return Array.from(allDates)
    .sort()
    .map(date => ({
      date,
      visits: 0,
      visitors: 0,
      registrations: regMap.get(date) || 0,
      newPro: proMap.get(date) || 0,
    }));
}

function periodKey(dateStr: string, period: 'day' | 'week' | 'month'): string {
  if (period === 'day') return dateStr; // YYYY-MM-DD
  if (period === 'month') return dateStr.slice(0, 7); // YYYY-MM

  // week: YYYY-Wxx
  const d = new Date(dateStr);
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
