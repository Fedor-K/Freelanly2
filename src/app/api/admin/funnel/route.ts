import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/funnel?days=7
 *
 * Returns funnel data: unique users at each stage of the conversion path.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Count unique users at each funnel step
    // Using raw query for efficiency
    const steps = await prisma.$queryRaw<Array<{ action: string; unique_users: bigint }>>`
      SELECT action, COUNT(DISTINCT "userId") as unique_users
      FROM "ActivityLog"
      WHERE "createdAt" >= ${since}
        AND "userId" IS NOT NULL
        AND action IN (
          'PAGE_VIEW',
          'JOB_VIEW',
          'OPPORTUNITY_VIEW',
          'PAYWALL_HIT',
          'UPGRADE_MODAL_OPEN',
          'PRICING_VIEW',
          'PRICING_PLAN_CLICK',
          'CHECKOUT_START',
          'CHECKOUT_COMPLETE',
          'SIGNUP_START',
          'SIGNUP_COMPLETE'
        )
      GROUP BY action
      ORDER BY unique_users DESC
    `;

    // Also count total unique visitors (including anonymous)
    const totalVisitors = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(DISTINCT COALESCE("userId", "sessionId")) as count
      FROM "ActivityLog"
      WHERE "createdAt" >= ${since}
        AND action = 'PAGE_VIEW'
    `;

    // Convert BigInt to number
    const stepsMap: Record<string, number> = {};
    for (const row of steps) {
      stepsMap[row.action] = Number(row.unique_users);
    }

    // Build funnel stages in order
    const visitorsCount = Number(totalVisitors[0]?.count || 0);
    const funnel = [
      {
        step: 1,
        action: 'PAGE_VIEW',
        label: 'Зашли на сайт',
        count: visitorsCount || stepsMap['PAGE_VIEW'] || 0,
      },
      {
        step: 2,
        action: 'JOB_VIEW',
        label: 'Посмотрели вакансию',
        count: (stepsMap['JOB_VIEW'] || 0) + (stepsMap['OPPORTUNITY_VIEW'] || 0),
      },
      {
        step: 3,
        action: 'SIGNUP_START',
        label: 'Начали регистрацию',
        count: stepsMap['SIGNUP_START'] || 0,
      },
      {
        step: 4,
        action: 'SIGNUP_COMPLETE',
        label: 'Завершили регистрацию',
        count: stepsMap['SIGNUP_COMPLETE'] || 0,
      },
      {
        step: 5,
        action: 'PAYWALL_HIT',
        label: 'Увидели paywall',
        count: stepsMap['PAYWALL_HIT'] || 0,
      },
      {
        step: 6,
        action: 'UPGRADE_MODAL_OPEN',
        label: 'Открыли окно апгрейда',
        count: stepsMap['UPGRADE_MODAL_OPEN'] || 0,
      },
      {
        step: 7,
        action: 'PRICING_VIEW',
        label: 'Зашли на /pricing',
        count: stepsMap['PRICING_VIEW'] || 0,
      },
      {
        step: 8,
        action: 'PRICING_PLAN_CLICK',
        label: 'Выбрали тариф',
        count: stepsMap['PRICING_PLAN_CLICK'] || 0,
      },
      {
        step: 9,
        action: 'CHECKOUT_START',
        label: 'Начали оплату',
        count: stepsMap['CHECKOUT_START'] || 0,
      },
      {
        step: 10,
        action: 'CHECKOUT_COMPLETE',
        label: 'Оплатили',
        count: stepsMap['CHECKOUT_COMPLETE'] || 0,
      },
    ];

    // Calculate percentages relative to step 1
    const base = funnel[0].count || 1;
    const funnelWithPercent = funnel.map((s) => ({
      ...s,
      percent: Math.round((s.count / base) * 1000) / 10,
    }));

    return NextResponse.json({
      days,
      since: since.toISOString(),
      funnel: funnelWithPercent,
    });
  } catch (error) {
    console.error('[Admin/Funnel] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch funnel data' }, { status: 500 });
  }
}
