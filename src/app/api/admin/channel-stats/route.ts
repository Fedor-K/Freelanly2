import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/admin/channel-stats
 * Returns registration, PRO conversion, and revenue stats grouped by traffic source.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const days = parseInt(searchParams.get('days') || '30', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Registrations by source
    const registrations = await prisma.$queryRaw<
      Array<{ source: string | null; count: bigint }>
    >`
      SELECT source, COUNT(*) as count
      FROM "User"
      WHERE "createdAt" >= ${since}
      GROUP BY source
      ORDER BY count DESC
    `;

    // 2. PRO conversions by source (users who upgraded to PRO)
    const proConversions = await prisma.$queryRaw<
      Array<{ source: string | null; count: bigint }>
    >`
      SELECT source, COUNT(*) as count
      FROM "User"
      WHERE plan = 'PRO'
        AND "createdAt" >= ${since}
      GROUP BY source
      ORDER BY count DESC
    `;

    // 3. Revenue by source (completed checkout sessions → user.source)
    const revenue = await prisma.$queryRaw<
      Array<{ source: string | null; total: bigint }>
    >`
      SELECT u.source, COALESCE(SUM(cs.amount), 0) as total
      FROM "CheckoutSession" cs
      JOIN "User" u ON u.id = cs."userId"
      WHERE cs.status = 'COMPLETED'
        AND cs."completedAt" >= ${since}
      GROUP BY u.source
      ORDER BY total DESC
    `;

    // 4. Active alerts by source
    const alerts = await prisma.$queryRaw<
      Array<{ source: string | null; count: bigint }>
    >`
      SELECT u.source, COUNT(*) as count
      FROM "JobAlert" ja
      JOIN "User" u ON u.id = ja."userId"
      WHERE ja."isActive" = true
        AND u."createdAt" >= ${since}
      GROUP BY u.source
      ORDER BY count DESC
    `;

    // 5. Daily trend (registrations per day per source, last N days)
    const trend = await prisma.$queryRaw<
      Array<{ date: Date; source: string | null; count: bigint }>
    >`
      SELECT DATE("createdAt") as date, source, COUNT(*) as count
      FROM "User"
      WHERE "createdAt" >= ${since}
      GROUP BY DATE("createdAt"), source
      ORDER BY date ASC
    `;

    // Merge into channel summary
    const channelMap = new Map<string, {
      channel: string;
      registrations: number;
      pro: number;
      alerts: number;
      revenue: number;
    }>();

    const getChannel = (source: string | null) => source || 'direct';
    const ensureChannel = (ch: string) => {
      if (!channelMap.has(ch)) {
        channelMap.set(ch, { channel: ch, registrations: 0, pro: 0, alerts: 0, revenue: 0 });
      }
      return channelMap.get(ch)!;
    };

    for (const r of registrations) {
      const ch = ensureChannel(getChannel(r.source));
      ch.registrations = Number(r.count);
    }
    for (const r of proConversions) {
      const ch = ensureChannel(getChannel(r.source));
      ch.pro = Number(r.count);
    }
    for (const r of revenue) {
      const ch = ensureChannel(getChannel(r.source));
      ch.revenue = Number(r.total);
    }
    for (const r of alerts) {
      const ch = ensureChannel(getChannel(r.source));
      ch.alerts = Number(r.count);
    }

    // Build channels array with conv rate
    const channels = Array.from(channelMap.values()).map(ch => ({
      ...ch,
      convRate: ch.registrations > 0 ? Math.round((ch.pro / ch.registrations) * 1000) / 10 : 0,
      revenue: ch.revenue / 100, // cents → dollars
    }));

    // Sort by registrations desc
    channels.sort((a, b) => b.registrations - a.registrations);

    // Format trend for charts
    const trendData = trend.map(t => ({
      date: new Date(t.date).toISOString().split('T')[0],
      channel: getChannel(t.source),
      count: Number(t.count),
    }));

    return NextResponse.json({ channels, trend: trendData, days });
  } catch (error) {
    console.error('[ChannelStats] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch channel stats' }, { status: 500 });
  }
}
