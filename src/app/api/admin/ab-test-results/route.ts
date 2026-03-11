import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminSession } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  const variants = ['A', 'B', 'C'] as const;

  // 1. Free nurture DAY_7
  const freeNurture = await Promise.all(
    variants.map(async (v) => {
      const [total, converted] = await Promise.all([
        prisma.user.count({ where: { nurtureEmailVariant: v } }),
        prisma.user.count({ where: { nurtureEmailVariant: v, plan: 'PRO' } }),
      ]);
      return { variant: v, total, converted, rate: total > 0 ? +((converted / total) * 100).toFixed(1) : 0 };
    })
  );

  // 2. Abandoned checkout
  const abandonedRaw = await prisma.abandonedCheckoutEmail.groupBy({
    by: ['abVariant'],
    _count: { id: true },
    where: { abVariant: { not: null } },
  });
  // Conversions: abandoned email sent → user converted
  const abandonedConverted = await prisma.abandonedCheckoutEmail.groupBy({
    by: ['abVariant'],
    _count: { id: true },
    where: { abVariant: { not: null }, convertedAt: { not: null } },
  });
  const abConvMap = Object.fromEntries(abandonedConverted.map(r => [r.abVariant, r._count.id]));
  const abandoned = abandonedRaw.map(r => ({
    variant: r.abVariant!,
    total: r._count.id,
    converted: abConvMap[r.abVariant!] || 0,
    rate: +((abConvMap[r.abVariant!] || 0) / r._count.id * 100).toFixed(1),
  })).sort((a, b) => a.variant.localeCompare(b.variant));

  // 3. Winback
  const winbackRaw = await prisma.winbackEmail.groupBy({
    by: ['abVariant'],
    _count: { id: true },
    where: { abVariant: { not: null } },
  });
  const winbackConverted = await prisma.winbackEmail.groupBy({
    by: ['abVariant'],
    _count: { id: true },
    where: { abVariant: { not: null }, resubscribedAt: { not: null } },
  });
  const wbConvMap = Object.fromEntries(winbackConverted.map(r => [r.abVariant, r._count.id]));
  const winback = winbackRaw.map(r => ({
    variant: r.abVariant!,
    total: r._count.id,
    converted: wbConvMap[r.abVariant!] || 0,
    rate: +((wbConvMap[r.abVariant!] || 0) / r._count.id * 100).toFixed(1),
  })).sort((a, b) => a.variant.localeCompare(b.variant));

  return NextResponse.json({
    freeNurtureDay7: freeNurture,
    abandonedCheckout: abandoned,
    winback,
    note: 'Conversion = upgraded to PRO (nurture) / completed purchase (abandoned) / resubscribed (winback)',
  });
}
