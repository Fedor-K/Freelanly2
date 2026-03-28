/**
 * Admin API: Keyword → Revenue Funnel
 *
 * GET /api/admin/keyword-funnel
 * Tracks the full funnel: keyword → opportunities → alert sends → registrations → paid users
 *
 * Query params:
 * - days: Number of days to look back (default 30)
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';

interface KeywordFunnelRow {
  keyword: string;
  opportunities: number;
  alert_sends: number;
  unique_users_notified: number;
  paid_users: number;
  revenue_cents: number;
}

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  try {
    const days = parseInt(request.nextUrl.searchParams.get('days') || '30');
    const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Full funnel query: keyword → opportunities → alert notifications → users → revenue
    const funnel = await prisma.$queryRaw<KeywordFunnelRow[]>`
      SELECT
        o."sourceKeyword" AS keyword,
        COUNT(DISTINCT o.id)::int AS opportunities,
        COUNT(DISTINCT an.id)::int AS alert_sends,
        COUNT(DISTINCT ja."userId")::int AS unique_users_notified,
        COUNT(DISTINCT CASE WHEN re.type = 'SUBSCRIPTION_STARTED' THEN re."userId" END)::int AS paid_users,
        COALESCE(SUM(CASE WHEN re.type = 'SUBSCRIPTION_STARTED' THEN re.amount ELSE 0 END), 0)::int AS revenue_cents
      FROM "Opportunity" o
      LEFT JOIN "AlertNotification" an ON an."opportunityId" = o.id
      LEFT JOIN "JobAlert" ja ON ja.id = an."jobAlertId"
      LEFT JOIN "RevenueEvent" re ON re."userId" = ja."userId"
        AND re."createdAt" >= o."createdAt"
        AND re."createdAt" <= o."createdAt" + INTERVAL '30 days'
      WHERE o."sourceKeyword" IS NOT NULL
        AND o."createdAt" >= ${sinceDate}
      GROUP BY o."sourceKeyword"
      ORDER BY opportunities DESC
    `;

    // Summary totals
    const totals = funnel.reduce(
      (acc, row) => {
        acc.opportunities += row.opportunities;
        acc.alert_sends += row.alert_sends;
        acc.unique_users_notified += row.unique_users_notified;
        acc.paid_users += row.paid_users;
        acc.revenue_cents += row.revenue_cents;
        return acc;
      },
      { opportunities: 0, alert_sends: 0, unique_users_notified: 0, paid_users: 0, revenue_cents: 0 }
    );

    // Add conversion rates to each row
    const funnelWithRates = funnel.map((row) => ({
      ...row,
      revenue: `$${(row.revenue_cents / 100).toFixed(2)}`,
      conversionRate:
        row.unique_users_notified > 0
          ? `${((row.paid_users / row.unique_users_notified) * 100).toFixed(1)}%`
          : '0%',
      revenuePerOpp:
        row.opportunities > 0
          ? `$${(row.revenue_cents / 100 / row.opportunities).toFixed(2)}`
          : '$0.00',
    }));

    return NextResponse.json({
      success: true,
      days,
      funnel: funnelWithRates,
      totals: {
        ...totals,
        revenue: `$${(totals.revenue_cents / 100).toFixed(2)}`,
        keywords: funnel.length,
        conversionRate:
          totals.unique_users_notified > 0
            ? `${((totals.paid_users / totals.unique_users_notified) * 100).toFixed(1)}%`
            : '0%',
      },
    });
  } catch (error) {
    console.error('[KeywordFunnel] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword funnel', details: String(error) },
      { status: 500 }
    );
  }
}
