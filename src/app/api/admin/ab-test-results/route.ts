import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminSession } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  const variants = ['A', 'B', 'C'] as const;

  const results = await Promise.all(
    variants.map(async (variant) => {
      const [total, converted] = await Promise.all([
        prisma.user.count({
          where: { nurtureEmailVariant: variant },
        }),
        prisma.user.count({
          where: { nurtureEmailVariant: variant, plan: 'PRO' },
        }),
      ]);

      return {
        variant,
        total,
        converted,
        conversionRate: total > 0 ? ((converted / total) * 100).toFixed(1) + '%' : '0%',
      };
    })
  );

  // Also count users who received DAY_7 but variant not saved yet (legacy)
  const noVariant = await prisma.user.count({
    where: { nurtureEmailVariant: null, freeNurtureEmailsSent: { gte: 3 } },
  });

  return NextResponse.json({
    results,
    noVariantYet: noVariant,
    note: 'Only DAY_7 recipients are tracked. Data accumulates over time.',
  });
}
