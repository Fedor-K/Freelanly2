import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/analytics?period=30d
 * Returns reply rate by source, by hour, daily breakdown.
 * period: 7d, 30d, 90d, ytd, all
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const period = request.nextUrl.searchParams.get('period') || '30d';

    let since: Date | null = null;
    if (period === '7d') since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    else if (period === '30d') since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    else if (period === '90d') since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    else if (period === 'ytd') { since = new Date(new Date().getFullYear(), 0, 1); }

    // All sent applications (filtered by period)
    const apps = await prisma.autoApplication.findMany({
      where: { userId, sentAt: since ? { gte: since } : { not: null } },
      select: { status: true, sentAt: true, sentVia: true, matchScore: true },
    });

    // Reply rate by source (smtp vs postal)
    const bySource: Record<string, { sent: number; replied: number }> = {};
    for (const app of apps) {
      const source = app.sentVia || 'unknown';
      if (!bySource[source]) bySource[source] = { sent: 0, replied: 0 };
      bySource[source].sent++;
      if (['REPLIED', 'INTERVIEW', 'OFFER'].includes(app.status)) {
        bySource[source].replied++;
      }
    }

    const sourceStats = Object.entries(bySource).map(([source, data]) => ({
      source,
      sent: data.sent,
      replied: data.replied,
      replyRate: data.sent > 0 ? ((data.replied / data.sent) * 100).toFixed(1) : '0',
    }));

    // Reply rate by hour sent
    const byHour: Record<number, { sent: number; replied: number }> = {};
    for (let h = 0; h < 24; h++) byHour[h] = { sent: 0, replied: 0 };
    for (const app of apps) {
      if (app.sentAt) {
        const hour = app.sentAt.getUTCHours();
        byHour[hour].sent++;
        if (['REPLIED', 'INTERVIEW', 'OFFER'].includes(app.status)) {
          byHour[hour].replied++;
        }
      }
    }

    const hourStats = Object.entries(byHour)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        sent: data.sent,
        replied: data.replied,
        replyRate: data.sent > 0 ? ((data.replied / data.sent) * 100).toFixed(1) : '0',
      }))
      .filter(h => h.sent > 0);

    // Daily breakdown (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailyApps = apps.filter(a => a.sentAt && a.sentAt >= thirtyDaysAgo);
    const byDay: Record<string, { sent: number; replied: number; opened: number }> = {};

    for (const app of dailyApps) {
      const day = app.sentAt!.toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { sent: 0, replied: 0, opened: 0 };
      byDay[day].sent++;
      if (['REPLIED', 'INTERVIEW', 'OFFER'].includes(app.status)) byDay[day].replied++;
      if (app.status === 'OPENED') byDay[day].opened++;
    }

    const dailyStats = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, data]) => ({ day, ...data }));

    // Best hour
    const bestHour = hourStats.reduce((best, h) =>
      parseFloat(h.replyRate) > parseFloat(best.replyRate) ? h : best,
      { hour: 9, sent: 0, replied: 0, replyRate: '0' }
    );

    return NextResponse.json({
      sourceStats,
      hourStats,
      dailyStats,
      bestHour: bestHour.sent > 0 ? bestHour : null,
      total: { sent: apps.length, replied: apps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length },
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
