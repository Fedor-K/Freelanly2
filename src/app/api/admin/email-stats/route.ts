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
      uniqueClickers,
      uniqueDelivered,
    ] = await Promise.all([
      // Total events count
      prisma.emailEvent.count(),

      // Events by type (ALL TIME)
      prisma.emailEvent.groupBy({
        by: ['type'],
        _count: true,
      }),

      // Recent events (more for filtering)
      prisma.emailEvent.findMany({
        take: 100,
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

      // Unique users who clicked (ALL TIME)
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "to") as count
        FROM "EmailEvent"
        WHERE "type" = 'CLICKED'
      `,

      // Unique users who received emails (ALL TIME)
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT "to") as count
        FROM "EmailEvent"
        WHERE "type" = 'DELIVERED'
      `,
    ]);

    // Get REAL email stats (unique email + date = one email)
    const [
      realEmailsTotal,
      realEmailsLast7Days,
      realEmailsLast30Days,
      uniqueRecipients,
      totalNotifications,
    ] = await Promise.all([
      // Total unique emails sent
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT CONCAT(ja."email", DATE(an."sentAt"))) as count
        FROM "AlertNotification" an
        JOIN "JobAlert" ja ON an."jobAlertId" = ja."id"
        WHERE an."status" = 'SENT'
      `,
      // Last 7 days
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT CONCAT(ja."email", DATE(an."sentAt"))) as count
        FROM "AlertNotification" an
        JOIN "JobAlert" ja ON an."jobAlertId" = ja."id"
        WHERE an."status" = 'SENT' AND an."sentAt" >= ${sevenDaysAgo}
      `,
      // Last 30 days
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT CONCAT(ja."email", DATE(an."sentAt"))) as count
        FROM "AlertNotification" an
        JOIN "JobAlert" ja ON an."jobAlertId" = ja."id"
        WHERE an."status" = 'SENT' AND an."sentAt" >= ${thirtyDaysAgo}
      `,
      // Unique recipients
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT ja."email") as count
        FROM "AlertNotification" an
        JOIN "JobAlert" ja ON an."jobAlertId" = ja."id"
        WHERE an."status" = 'SENT'
      `,
      // Total job notifications (for avg calculation)
      prisma.alertNotification.count({ where: { status: 'SENT' } }),
    ]);

    const emailsSentTotal = Number(realEmailsTotal[0]?.count || 0);
    const emailsSent7Days = Number(realEmailsLast7Days[0]?.count || 0);
    const emailsSent30Days = Number(realEmailsLast30Days[0]?.count || 0);
    const uniqueUsers = Number(uniqueRecipients[0]?.count || 0);
    const avgJobsPerEmail = emailsSentTotal > 0 ? (totalNotifications / emailsSentTotal).toFixed(1) : '0';

    // Process events by type
    const eventCounts: Record<string, number> = {};
    for (const event of eventsByType) {
      eventCounts[event.type] = event._count;
    }

    // Calculate rates
    const sent = eventCounts['SENT'] || 0;
    const delivered = eventCounts['DELIVERED'] || 0;
    const opened = eventCounts['OPENED'] || 0;
    const clickedTotal = eventCounts['CLICKED'] || 0; // Total click events
    const bounced = eventCounts['BOUNCED'] || 0;
    const complained = eventCounts['COMPLAINED'] || 0;

    // Unique users who clicked/received
    const uniqueClickedCount = Number(uniqueClickers[0]?.count || 0);
    const uniqueDeliveredCount = Number(uniqueDelivered[0]?.count || 0);

    const deliveryRate = sent > 0 ? ((delivered / sent) * 100).toFixed(1) : '0';
    const openRate = delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : '0';
    // Click rate = unique users who clicked / unique users who received
    const clickRate = uniqueDeliveredCount > 0 ? ((uniqueClickedCount / uniqueDeliveredCount) * 100).toFixed(1) : '0';
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
        clicked: uniqueClickedCount, // Unique users who clicked
        clickedTotal, // Total click events (for reference)
        bounced,
        complained,
        deliveryRate: parseFloat(deliveryRate),
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        bounceRate: parseFloat(bounceRate),
      },

      // Real email stats (unique email + date = one email sent)
      alerts: {
        emailsSent: emailsSentTotal,
        last7Days: emailsSent7Days,
        last30Days: emailsSent30Days,
        uniqueRecipients: uniqueUsers,
        avgJobsPerEmail: parseFloat(avgJobsPerEmail),
        totalJobNotifications: totalNotifications,
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
