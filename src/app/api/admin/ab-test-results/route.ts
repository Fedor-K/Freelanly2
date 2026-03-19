import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminSession } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  // 1. Abandoned checkout
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

  // 2. Winback
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
    abandonedCheckout: abandoned,
    winback,
    note: 'Conversion = completed purchase (abandoned) / resubscribed (winback)',
  });
}
