import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminSession } from '@/lib/admin-auth';

/**
 * GET /api/admin/cohorts
 *
 * Returns cohort retention data and activation funnel.
 */
export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;
  try {
    // === COHORT RETENTION ===
    // Group users by registration month, check if they had activity in subsequent months
    const cohortData = await prisma.$queryRaw<Array<{
      cohort_month: Date;
      total_users: bigint;
      month_offset: number;
      active_users: bigint;
    }>>`
      WITH cohorts AS (
        SELECT
          DATE_TRUNC('month', u."createdAt") AS cohort_month,
          u.id AS user_id
        FROM "User" u
        WHERE u."emailVerified" IS NOT NULL
          AND u."createdAt" >= NOW() - INTERVAL '12 months'
      ),
      months AS (
        SELECT generate_series(0, 11) AS month_offset
      ),
      activity AS (
        SELECT DISTINCT
          "userId",
          DATE_TRUNC('month', expires - INTERVAL '30 days') AS activity_month
        FROM "Session"
        WHERE expires > NOW() - INTERVAL '13 months'
        UNION
        SELECT DISTINCT
          "userId",
          DATE_TRUNC('month', "createdAt") AS activity_month
        FROM "ActivityLog"
        WHERE "userId" IS NOT NULL
          AND "createdAt" >= NOW() - INTERVAL '13 months'
      )
      SELECT
        c.cohort_month,
        COUNT(DISTINCT c.user_id) AS total_users,
        m.month_offset,
        COUNT(DISTINCT CASE
          WHEN a.activity_month = c.cohort_month + (m.month_offset || ' months')::INTERVAL
          THEN c.user_id
        END) AS active_users
      FROM cohorts c
      CROSS JOIN months m
      LEFT JOIN activity a ON a."userId" = c.user_id
      WHERE c.cohort_month + (m.month_offset || ' months')::INTERVAL <= DATE_TRUNC('month', NOW())
      GROUP BY c.cohort_month, m.month_offset
      ORDER BY c.cohort_month DESC, m.month_offset ASC
    `;

    // Transform into table format
    const cohortMap = new Map<string, { total: number; retention: Record<number, number> }>();

    for (const row of cohortData) {
      const key = new Date(row.cohort_month).toISOString().substring(0, 7); // YYYY-MM
      if (!cohortMap.has(key)) {
        cohortMap.set(key, { total: Number(row.total_users), retention: {} });
      }
      const total = cohortMap.get(key)!.total;
      const active = Number(row.active_users);
      cohortMap.get(key)!.retention[row.month_offset] = total > 0
        ? Math.round((active / total) * 100)
        : 0;
    }

    const cohorts = Array.from(cohortMap.entries()).map(([month, data]) => ({
      month,
      total: data.total,
      retention: data.retention,
    }));

    // === ACTIVATION FUNNEL ===
    // All-time funnel based on User table + ActivityLog
    const totalVisitors = await prisma.user.count({ where: { emailVerified: { not: null } } });

    // Users who viewed at least 1 job/opportunity
    const viewedJob = await prisma.$queryRaw<[{ cnt: bigint }]>`
      SELECT COUNT(DISTINCT "userId") as cnt FROM "ActivityLog"
      WHERE action IN ('JOB_VIEW', 'OPPORTUNITY_VIEW') AND "userId" IS NOT NULL
    `;

    // Users who hit paywall
    const hitPaywall = await prisma.$queryRaw<[{ cnt: bigint }]>`
      SELECT COUNT(DISTINCT "userId") as cnt FROM "ActivityLog"
      WHERE action = 'PAYWALL_HIT' AND "userId" IS NOT NULL
    `;

    // Users who viewed pricing
    const viewedPricing = await prisma.$queryRaw<[{ cnt: bigint }]>`
      SELECT COUNT(DISTINCT "userId") as cnt FROM "ActivityLog"
      WHERE action = 'PRICING_VIEW' AND "userId" IS NOT NULL
    `;

    // Users who started checkout
    const startedCheckout = await prisma.$queryRaw<[{ cnt: bigint }]>`
      SELECT COUNT(DISTINCT "userId") as cnt FROM "ActivityLog"
      WHERE action = 'CHECKOUT_START' AND "userId" IS NOT NULL
    `;

    // Converted (PRO)
    const converted = await prisma.user.count({ where: { plan: 'PRO' } });

    // Retained 7d (PRO users active in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const retained7d = await prisma.user.count({
      where: {
        plan: 'PRO',
        lastActiveAt: { gte: sevenDaysAgo },
      },
    });

    const activationFunnel = [
      { step: 'signed_up', label: 'Signed Up', count: totalVisitors },
      { step: 'viewed_job', label: 'Viewed Job', count: Number(viewedJob[0].cnt) },
      { step: 'hit_paywall', label: 'Hit Paywall', count: Number(hitPaywall[0].cnt) },
      { step: 'viewed_pricing', label: 'Viewed Pricing', count: Number(viewedPricing[0].cnt) },
      { step: 'started_checkout', label: 'Started Checkout', count: Number(startedCheckout[0].cnt) },
      { step: 'converted', label: 'Converted', count: converted },
      { step: 'retained_7d', label: 'Retained 7d', count: retained7d },
    ];

    // Add percentages
    const base = activationFunnel[0].count || 1;
    const funnelWithPercent = activationFunnel.map(s => ({
      ...s,
      percent: Math.round((s.count / base) * 1000) / 10,
    }));

    return NextResponse.json({
      cohorts,
      activationFunnel: funnelWithPercent,
    });
  } catch (error) {
    console.error('[Cohorts API] Error:', error);
    return NextResponse.json({ error: 'Failed to load cohort data' }, { status: 500 });
  }
}
