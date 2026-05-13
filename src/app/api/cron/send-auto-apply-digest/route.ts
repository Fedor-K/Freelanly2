import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/postal';
import { isCronAuthorized } from '@/lib/cron-auth';

/**
 * POST /api/cron/send-auto-apply-digest
 * Sends daily digest + weekly report + pause alerts for auto-apply users.
 * Run daily at 09:00 UTC.
 */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const isMonday = now.getUTCDay() === 1;
  const yesterday = new Date(Date.now() - 86400000);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  let dailySent = 0;
  let weeklySent = 0;
  let pauseAlertsSent = 0;

  try {
    // Find users with active auto-apply who want notifications
    const users = await prisma.user.findMany({
      where: {
        notifyDigest: true,
        autoApplyLoops: { some: { isActive: true } },
      },
      select: {
        id: true,
        name: true,
        email: true,
        notifyDigest: true,
        lastActiveAt: true,
        autoApplyLoops: {
          where: { isActive: true },
          select: { id: true, pauseOnUnanswered: true, pauseOnLowRate: true, pauseOnInactive: true },
          take: 1,
        },
      },
    });

    for (const user of users) {
      const firstName = user.name?.split(' ')[0] || 'there';
      const loop = user.autoApplyLoops[0];

      // Get yesterday's stats
      const [sentYesterday, repliedYesterday, openedYesterday] = await Promise.all([
        prisma.autoApplication.count({ where: { userId: user.id, sentAt: { gte: yesterday } } }),
        prisma.autoApplication.count({ where: { userId: user.id, status: { in: ['REPLIED', 'INTERVIEW'] }, repliedAt: { gte: yesterday } } }),
        prisma.autoApplication.count({ where: { userId: user.id, status: 'OPENED', updatedAt: { gte: yesterday } } }),
      ]);

      // Skip if no activity
      if (sentYesterday === 0 && repliedYesterday === 0) continue;

      // === DAILY DIGEST ===
      try {
        await sendEmail({
          to: user.email,
          subject: `📊 Daily: ${sentYesterday} sent, ${repliedYesterday} replies — Freelanly`,
          html: `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
            <h2 style="margin: 0 0 16px;">Hi ${firstName}, here's yesterday's update</h2>
            <div style="background: #f7f6f1; border-radius: 12px; padding: 20px; margin: 16px 0;">
              <div style="display: flex; gap: 24px; text-align: center;">
                <div><div style="font-size: 28px; font-weight: 600;">${sentYesterday}</div><div style="font-size: 13px; color: #666;">Sent</div></div>
                <div><div style="font-size: 28px; font-weight: 600;">${openedYesterday}</div><div style="font-size: 13px; color: #666;">Opened</div></div>
                <div><div style="font-size: 28px; font-weight: 600; color: #4D8B0A;">${repliedYesterday}</div><div style="font-size: 13px; color: #666;">Replies</div></div>
              </div>
            </div>
            ${repliedYesterday > 0 ? '<p style="color: #555;">You have new replies waiting in your inbox!</p>' : ''}
            <a href="https://freelanly.com/dashboard/auto-apply" style="display: inline-block; padding: 12px 24px; background: #C7F94A; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 12px;">Open Dashboard →</a>
            <p style="color: #999; font-size: 12px; margin-top: 24px;"><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(user.email)}" style="color: #999;">Unsubscribe from digests</a></p>
          </div>`,
          text: `Hi ${firstName}, yesterday: ${sentYesterday} sent, ${openedYesterday} opened, ${repliedYesterday} replies. Open dashboard: https://freelanly.com/dashboard/auto-apply`,
        });
        dailySent++;
      } catch (e) {
        console.error(`[Digest] Failed for ${user.email}:`, e);
      }

      // === WEEKLY REPORT (Mondays) ===
      if (isMonday) {
        const [sentWeek, repliedWeek] = await Promise.all([
          prisma.autoApplication.count({ where: { userId: user.id, sentAt: { gte: weekAgo } } }),
          prisma.autoApplication.count({ where: { userId: user.id, status: { in: ['REPLIED', 'INTERVIEW', 'OFFER'] }, repliedAt: { gte: weekAgo } } }),
        ]);
        const replyRate = sentWeek > 0 ? ((repliedWeek / sentWeek) * 100).toFixed(1) : '0';

        try {
          await sendEmail({
            to: user.email,
            subject: `📈 Weekly: ${sentWeek} sent, ${repliedWeek} replies (${replyRate}%) — Freelanly`,
            html: `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
              <h2 style="margin: 0 0 16px;">Weekly report for ${firstName}</h2>
              <div style="background: #f7f6f1; border-radius: 12px; padding: 20px; margin: 16px 0;">
                <div style="display: flex; gap: 24px; text-align: center;">
                  <div><div style="font-size: 28px; font-weight: 600;">${sentWeek}</div><div style="font-size: 13px; color: #666;">Sent this week</div></div>
                  <div><div style="font-size: 28px; font-weight: 600; color: #4D8B0A;">${repliedWeek}</div><div style="font-size: 13px; color: #666;">Replies</div></div>
                  <div><div style="font-size: 28px; font-weight: 600;">${replyRate}%</div><div style="font-size: 13px; color: #666;">Reply rate</div></div>
                </div>
              </div>
              <a href="https://freelanly.com/dashboard/auto-apply?tab=analytics" style="display: inline-block; padding: 12px 24px; background: #C7F94A; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 12px;">View Analytics →</a>
              <p style="color: #999; font-size: 12px; margin-top: 24px;"><a href="https://freelanly.com/unsubscribe?email=${encodeURIComponent(user.email)}" style="color: #999;">Unsubscribe</a></p>
            </div>`,
            text: `Weekly: ${sentWeek} sent, ${repliedWeek} replies, ${replyRate}% reply rate.`,
          });
          weeklySent++;
        } catch (e) {
          console.error(`[WeeklyReport] Failed for ${user.email}:`, e);
        }
      }

      // === PAUSE ALERTS ===
      if (loop) {
        let shouldPause = false;
        let pauseReason = '';

        // Check unanswered replies
        if (loop.pauseOnUnanswered) {
          const unanswered = await prisma.autoApplication.count({
            where: { userId: user.id, status: 'REPLIED', repliedAt: { gte: weekAgo } },
          });
          if (unanswered >= loop.pauseOnUnanswered) {
            shouldPause = true;
            pauseReason = `${unanswered} unanswered replies in your inbox`;
          }
        }

        // Check low reply rate
        if (!shouldPause && loop.pauseOnLowRate) {
          const [sent14d, replied14d] = await Promise.all([
            prisma.autoApplication.count({ where: { userId: user.id, sentAt: { gte: new Date(Date.now() - 14 * 86400000) } } }),
            prisma.autoApplication.count({ where: { userId: user.id, status: { in: ['REPLIED', 'INTERVIEW'] }, repliedAt: { gte: new Date(Date.now() - 14 * 86400000) } } }),
          ]);
          const rate = sent14d > 0 ? (replied14d / sent14d) * 100 : 0;
          if (sent14d >= 20 && rate < loop.pauseOnLowRate) {
            shouldPause = true;
            pauseReason = `Reply rate dropped to ${rate.toFixed(1)}% (below ${loop.pauseOnLowRate}% threshold)`;
          }
        }

        // Check inactivity
        if (!shouldPause && loop.pauseOnInactive && user.lastActiveAt) {
          const daysSinceActive = Math.floor((Date.now() - user.lastActiveAt.getTime()) / 86400000);
          if (daysSinceActive >= loop.pauseOnInactive) {
            shouldPause = true;
            pauseReason = `You haven't logged in for ${daysSinceActive} days`;
          }
        }

        if (shouldPause) {
          // Pause the loop
          await prisma.autoApplyLoop.update({
            where: { id: loop.id },
            data: { isActive: false },
          });

          // Send alert
          try {
            await sendEmail({
              to: user.email,
              subject: `⏸ Auto-apply paused — ${pauseReason}`,
              html: `<div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; padding: 32px;">
                <h2 style="margin: 0 0 16px;">Auto-apply paused</h2>
                <p style="color: #555; line-height: 1.6;">Hi ${firstName}, your auto-apply has been paused because: <strong>${pauseReason}</strong></p>
                <p style="color: #555;">This is a safety measure to protect your sending reputation. You can resume anytime from your dashboard.</p>
                <a href="https://freelanly.com/dashboard/auto-apply" style="display: inline-block; padding: 12px 24px; background: #C7F94A; color: #000; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 12px;">Resume Auto-Apply →</a>
              </div>`,
              text: `Auto-apply paused: ${pauseReason}. Resume: https://freelanly.com/dashboard/auto-apply`,
            });
            pauseAlertsSent++;
          } catch (e) {
            console.error(`[PauseAlert] Failed for ${user.email}:`, e);
          }
        }
      }
    }

    console.log(`[Digest] Daily: ${dailySent}, Weekly: ${weeklySent}, Pause alerts: ${pauseAlertsSent}`);
    return NextResponse.json({ dailySent, weeklySent, pauseAlertsSent });
  } catch (error) {
    console.error('[Digest] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
