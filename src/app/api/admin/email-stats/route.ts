import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get EmailEvent stats (from Resend webhooks)
    const [
      totalEvents,
      eventsByType,
      recentEvents,
      dailyStats,
    ] = await Promise.all([
      // Total events count
      prisma.emailEvent.count(),

      // Events by type (last 30 days)
      prisma.emailEvent.groupBy({
        by: ['type'],
        where: { timestamp: { gte: thirtyDaysAgo } },
        _count: true,
      }),

      // Recent events
      prisma.emailEvent.findMany({
        take: 20,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          type: true,
          to: true,
          subject: true,
          timestamp: true,
          metadata: true,
        },
      }),

      // Daily stats for chart (last 7 days)
      prisma.$queryRaw<Array<{ date: string; type: string; count: bigint }>>`
        SELECT
          DATE("timestamp") as date,
          "type",
          COUNT(*) as count
        FROM "EmailEvent"
        WHERE "timestamp" >= ${sevenDaysAgo}
        GROUP BY DATE("timestamp"), "type"
        ORDER BY date DESC
      `,
    ]);

    // Get AlertNotification stats
    const [
      totalNotifications,
      sentNotifications,
      notificationsLast7Days,
    ] = await Promise.all([
      prisma.alertNotification.count(),
      prisma.alertNotification.count({ where: { status: 'SENT' } }),
      prisma.alertNotification.count({
        where: {
          status: 'SENT',
          sentAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    // Process events by type
    const eventCounts: Record<string, number> = {};
    for (const event of eventsByType) {
      eventCounts[event.type] = event._count;
    }

    // Calculate rates
    const sent = eventCounts['SENT'] || 0;
    const delivered = eventCounts['DELIVERED'] || 0;
    const opened = eventCounts['OPENED'] || 0;
    const clicked = eventCounts['CLICKED'] || 0;
    const bounced = eventCounts['BOUNCED'] || 0;
    const complained = eventCounts['COMPLAINED'] || 0;

    const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : '0';
    const openRate = delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : '0';
    const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(1) : '0';
    const bounceRate = sent > 0 ? ((bounced / sent) * 100).toFixed(1) : '0';

    // Process daily stats for chart
    const dailyMap: Record<string, Record<string, number>> = {};
    for (const row of dailyStats) {
      const dateStr = new Date(row.date).toISOString().split('T')[0];
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
      }
      dailyMap[dateStr][row.type.toLowerCase()] = Number(row.count);
    }

    const chartData = Object.entries(dailyMap)
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),

      // Resend webhook events (30 days)
      resend: {
        totalEvents,
        hasData: totalEvents > 0,
        sent,
        delivered,
        opened,
        clicked,
        bounced,
        complained,
        deliveryRate: parseFloat(deliveryRate),
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        bounceRate: parseFloat(bounceRate),
      },

      // AlertNotification stats (from DB)
      alerts: {
        total: totalNotifications,
        sent: sentNotifications,
        last7Days: notificationsLast7Days,
      },

      // Recent events
      recentEvents: recentEvents.map(e => ({
        ...e,
        timestamp: e.timestamp.toISOString(),
      })),

      // Chart data
      chartData,
    });
  } catch (error) {
    console.error('[Email Stats API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email stats' },
      { status: 500 }
    );
  }
}
