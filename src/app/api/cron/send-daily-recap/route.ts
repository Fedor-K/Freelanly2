import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { dailyRecapEmail } from '@/lib/email-templates';

/**
 * Timezones grouped by UTC offset (hours).
 * Used as fallback when user has no timezone set.
 * Default: UTC+0 (sends at 19:00 UTC).
 */
const TARGET_HOUR = 19; // 19:00 local time

function getUtcOffsetForTimezone(tz: string): number {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false });
    const localHour = parseInt(formatter.format(now));
    const utcHour = now.getUTCHours();
    let offset = localHour - utcHour;
    if (offset > 12) offset -= 24;
    if (offset < -12) offset += 24;
    return offset;
  } catch {
    return 0;
  }
}

/**
 * POST /api/cron/send-daily-recap
 * Send daily recap email to users whose local time is ~19:00.
 * Called hourly from Hetzner cron.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const currentUtcHour = now.getUTCHours();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekAgo = new Date(todayStart.getTime() - 7 * 86400000);

    // Find users with active loops who had sends today
    const usersWithActivity = await prisma.autoApplication.groupBy({
      by: ['userId'],
      where: { sentAt: { gte: todayStart } },
      _count: true,
    });

    let sent = 0;
    let skipped = 0;
    let wrongTime = 0;

    for (const { userId, _count: sentToday } of usersWithActivity) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true, unsubscribedFromMarketing: true, timezone: true },
        });

        if (!user || user.unsubscribedFromMarketing) { skipped++; continue; }
        if (sentToday === 0) { skipped++; continue; }

        // Check if it's ~19:00 in user's timezone
        const userOffset = user.timezone ? getUtcOffsetForTimezone(user.timezone) : 0;
        const userLocalHour = (currentUtcHour + userOffset + 24) % 24;
        if (userLocalHour !== TARGET_HOUR) { wrongTime++; continue; }

        // Today's stats
        const [openedToday, repliesToday] = await Promise.all([
          prisma.autoApplication.count({
            where: { userId, status: { in: ['OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'] }, sentAt: { gte: todayStart } },
          }),
          prisma.autoApplication.count({
            where: { userId, repliedAt: { gte: todayStart } },
          }),
        ]);

        // Week stats
        const [weekSent, weekReplies] = await Promise.all([
          prisma.autoApplication.count({ where: { userId, sentAt: { gte: weekAgo } } }),
          prisma.autoApplication.count({ where: { userId, repliedAt: { gte: weekAgo } } }),
        ]);

        const replyRate = weekSent > 0 ? (weekReplies / weekSent * 100).toFixed(1) : '0';

        // Pending replies (recruiter replied but user hasn't responded)
        const pendingApps = await prisma.autoApplication.findMany({
          where: {
            userId,
            status: { in: ['REPLIED', 'INTERVIEW'] },
            repliedAt: { not: null },
          },
          select: { id: true, companyName: true, replyText: true },
          orderBy: { repliedAt: 'desc' },
          take: 3,
        });

        // Filter out ones user already replied to
        const userRepliedAppIds = new Set(
          (await prisma.message.findMany({
            where: { applicationId: { in: pendingApps.map(a => a.id) }, from: 'user' },
            select: { applicationId: true },
          })).map(m => m.applicationId)
        );

        const pendingReplies = pendingApps
          .filter(a => !userRepliedAppIds.has(a.id))
          .map(a => ({
            company: a.companyName,
            preview: (a.replyText || '').slice(0, 100) + ((a.replyText?.length || 0) > 100 ? '...' : ''),
            replyUrl: `https://freelanly.com/dashboard/inbox`,
          }));

        const email = dailyRecapEmail({
          userName: user.name || 'there',
          sent: sentToday,
          opened: openedToday,
          replies: repliesToday,
          weekSent,
          weekReplies,
          replyRate,
          pendingReplies,
        });

        await sendEmail({
          to: user.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });

        sent++;
      } catch (err) {
        console.error(`[DailyRecap] Failed for ${userId}:`, err);
        skipped++;
      }
    }

    console.log(`[DailyRecap] UTC hour: ${currentUtcHour}, Sent: ${sent}, Skipped: ${skipped}, WrongTime: ${wrongTime}`);
    return NextResponse.json({ sent, skipped, wrongTime, utcHour: currentUtcHour });
  } catch (error) {
    console.error('[DailyRecap] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
