import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/dashboard?period=7d
 * Returns dashboard data filtered by period: today, 7d, 30d, all
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const period = request.nextUrl.searchParams.get('period') || '7d';
    const userId = session.user.id;

    // Calculate date range
    let since: Date | null = null;
    const now = new Date();
    if (period === 'today') {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === '7d') {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === '30d') {
      since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    // 'all' = null (no filter)

    const where: Record<string, unknown> = { userId };
    if (since) where.sentAt = { gte: since };

    // KPIs
    const apps = await prisma.autoApplication.findMany({
      where: { userId, ...(since ? { sentAt: { gte: since } } : {}) },
      select: { status: true, sentAt: true, followUpSentAt: true, repliedAt: true },
    });

    const sent = apps.filter(a => a.sentAt).length;
    const opened = apps.filter(a => a.status === 'OPENED').length;
    const replied = apps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length;
    const followUps = apps.filter(a => a.followUpSentAt).length;
    const interviews = apps.filter(a => a.status === 'INTERVIEW').length;
    // Real recruiter rejection = a reply marked "not a fit". Exclude the matcher's
    // phantom REJECTED rows (never sent, no reply) so users don't see false rejections.
    const rejected = apps.filter(a => a.status === 'REJECTED' && a.repliedAt).length;

    // Previous period for comparison
    let prevSent = 0;
    let prevReplied = 0;
    if (since) {
      const periodMs = Date.now() - since.getTime();
      const prevSince = new Date(since.getTime() - periodMs);
      const prevApps = await prisma.autoApplication.findMany({
        where: { userId, sentAt: { gte: prevSince, lt: since } },
        select: { status: true, sentAt: true },
      });
      prevSent = prevApps.filter(a => a.sentAt).length;
      prevReplied = prevApps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length;
    }

    const sentDelta = prevSent > 0 ? Math.round(((sent - prevSent) / prevSent) * 100) : 0;
    const replyRate = sent > 0 ? ((replied / sent) * 100).toFixed(1) : '0';
    const prevReplyRate = prevSent > 0 ? ((prevReplied / prevSent) * 100).toFixed(1) : '0';
    const replyRateDelta = (parseFloat(replyRate) - parseFloat(prevReplyRate)).toFixed(1);

    // Get user rate floor for queue annotations
    const userProfile = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, rateFloorHourly: true, rateFloorProject: true, parsedProfile: true },
    });

    // Actionable signal: if the résumé didn't parse (no skills + no languages) auto-apply
    // can't run — surface a "re-upload résumé" nudge instead of silently producing nothing.
    const pp = (userProfile?.parsedProfile || {}) as Record<string, unknown>;
    const needsResumeReupload =
      ((pp.skills as unknown[])?.length || 0) === 0 && ((pp.languages as unknown[])?.length || 0) === 0;

    // Queue (pending)
    const queueRaw = await prisma.autoApplication.findMany({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, jobTitle: true, companyName: true, matchScore: true, matchLabel: true, createdAt: true,
        jobId: true, opportunityId: true,
      },
    });

    // Annotate queue items with rate floor warning
    const queue = queueRaw.map(q => {
      const belowRateFloor = false; // TODO: compare job salary with user rate floor when salary parsing is available
      return { ...q, belowRateFloor };
    });

    // Recent replies
    const replies = await prisma.autoApplication.findMany({
      where: { userId, status: { in: ['REPLIED', 'INTERVIEW', 'OFFER'] } },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true, jobTitle: true, companyName: true, status: true, replyText: true, replyCategory: true, repliedAt: true, updatedAt: true,
      },
    });

    // Daily activity (for chart)
    const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const dailySince = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const dailyApps = await prisma.autoApplication.findMany({
      where: { userId, sentAt: { gte: dailySince } },
      select: { sentAt: true, status: true },
    });

    const dailyMap: Record<string, { sent: number; replied: number }> = {};
    for (const a of dailyApps) {
      if (!a.sentAt) continue;
      const day = a.sentAt.toISOString().slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { sent: 0, replied: 0 };
      dailyMap[day].sent++;
      if (['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)) dailyMap[day].replied++;
    }
    const activity = Object.entries(dailyMap).sort(([a], [b]) => a.localeCompare(b)).map(([day, d]) => ({ day, ...d }));

    // Funnel
    const allApps = await prisma.autoApplication.findMany({
      where: { userId, sentAt: { not: null } },
      select: { status: true },
    });
    const funnel = {
      sent: allApps.length,
      opened: allApps.filter(a => ['OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length,
      replied: allApps.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status)).length,
      interview: allApps.filter(a => ['INTERVIEW', 'OFFER'].includes(a.status)).length,
      offer: allApps.filter(a => a.status === 'OFFER').length,
    };

    // Greeting
    const hour = new Date().getUTCHours();
    const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const pendingCount = await prisma.autoApplication.count({ where: { userId, status: 'PENDING' } });
    const newReplies = await prisma.autoApplication.count({
      where: { userId, status: { in: ['REPLIED', 'INTERVIEW'] }, repliedAt: { gte: new Date(Date.now() - 86400000) } },
    });
    const firstName = userProfile?.name?.split(' ')[0] || 'there';
    const greeting = `Good ${timeOfDay}, ${firstName}. ${pendingCount} applications queued${newReplies > 0 ? `, ${newReplies} new ${newReplies === 1 ? 'reply' : 'replies'} waiting` : ''}.`;

    return NextResponse.json({
      period,
      greeting,
      kpis: {
        sent, opened, replied, followUps, interviews, rejected,
        replyRate, sentDelta, replyRateDelta,
      },
      queue,
      replies: replies.map(r => ({
        ...r,
        replyText: r.replyText?.slice(0, 100) || '',
      })),
      activity,
      funnel,
      needsResumeReupload,
    });
  } catch (error) {
    console.error('[Dashboard] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
