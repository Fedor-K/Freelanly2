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

    // Template performance
    const templates = await prisma.coverLetterTemplate.findMany({
      where: { userId },
      select: { id: true, name: true, sentCount: true, replyCount: true, type: true },
      orderBy: { replyCount: 'desc' },
    });
    const templateStats = templates.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      sent: t.sentCount,
      replies: t.replyCount,
      replyRate: t.sentCount > 0 ? ((t.replyCount / t.sentCount) * 100).toFixed(1) : '0',
    }));

    // KPI deltas — compare current period vs previous period
    const totalSent = apps.length;
    const totalReplied = apps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length;
    const replyRate = totalSent > 0 ? (totalReplied / totalSent) * 100 : 0;
    const projectsClosed = apps.filter(a => a.status === 'OFFER').length;

    let prevSent = 0, prevReplied = 0;
    if (since) {
      const prevPeriodStart = new Date(since.getTime() - (Date.now() - since.getTime()));
      const prevApps = await prisma.autoApplication.findMany({
        where: { userId, sentAt: { gte: prevPeriodStart, lt: since } },
        select: { status: true },
      });
      prevSent = prevApps.length;
      prevReplied = prevApps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length;
    }
    const prevReplyRate = prevSent > 0 ? (prevReplied / prevSent) * 100 : 0;

    // AI insight
    let aiInsight: string | null = null;
    if (sourceStats.length > 1) {
      const sorted = [...sourceStats].sort((a, b) => parseFloat(b.replyRate) - parseFloat(a.replyRate));
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];
      if (best.source !== worst.source && parseFloat(best.replyRate) > parseFloat(worst.replyRate) * 1.5) {
        aiInsight = `${best.source} has ${best.replyRate}% reply rate vs ${worst.source} at ${worst.replyRate}%. Consider shifting more volume to ${best.source}.`;
      }
    }
    if (!aiInsight && bestHour.sent > 5) {
      aiInsight = `Your best send hour is ${bestHour.hour}:00 UTC with ${bestHour.replyRate}% reply rate. Consider concentrating sends around this time.`;
    }

    return NextResponse.json({
      kpis: {
        sent: { value: totalSent, delta: prevSent > 0 ? Math.round(((totalSent - prevSent) / prevSent) * 100) : null },
        replies: { value: totalReplied, delta: prevReplied > 0 ? Math.round(((totalReplied - prevReplied) / prevReplied) * 100) : null },
        replyRate: { value: Math.round(replyRate * 10) / 10, delta: prevReplyRate > 0 ? Math.round((replyRate - prevReplyRate) * 10) / 10 : null },
        projectsClosed: { value: projectsClosed },
      },
      sourceStats,
      hourStats,
      dailyStats,
      templateStats,
      bestHour: bestHour.sent > 0 ? bestHour : null,
      aiInsight,
    });
  } catch (error) {
    console.error('[Analytics] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
