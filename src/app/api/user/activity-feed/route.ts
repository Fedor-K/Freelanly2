import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

function ago(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const dayAgo = new Date(Date.now() - 24 * 3600000);

    // Get recent activity for this user
    const [sent, opened, replies, queued, matched] = await Promise.all([
      prisma.autoApplication.findMany({
        where: { userId, sentAt: { gte: dayAgo }, status: { in: ['SENT', 'DELIVERED'] } },
        orderBy: { sentAt: 'desc' },
        take: 5,
        select: { id: true, companyName: true, jobTitle: true, sentAt: true, appliedToEmail: true },
      }),
      prisma.autoApplication.findMany({
        where: { userId, status: 'OPENED', sentAt: { gte: dayAgo } },
        orderBy: { sentAt: 'desc' },
        take: 3,
        select: { id: true, companyName: true, jobTitle: true, sentAt: true },
      }),
      prisma.autoApplication.findMany({
        where: { userId, status: { in: ['REPLIED', 'INTERVIEW'] }, repliedAt: { gte: dayAgo } },
        orderBy: { repliedAt: 'desc' },
        take: 3,
        select: { id: true, companyName: true, jobTitle: true, repliedAt: true, replyCategory: true },
      }),
      prisma.autoApplication.count({
        where: { userId, status: { in: ['PENDING', 'REVIEW'] } },
      }),
      prisma.autoApplication.count({
        where: { userId, createdAt: { gte: dayAgo } },
      }),
    ]);

    // Build feed items
    const items: Array<{ id: string; icon: string; text: string; time: string; type: string; sort: number }> = [];

    // Scanning indicator (always show if loop active)
    const loop = await prisma.autoApplyLoop.findFirst({ where: { userId, isActive: true }, select: { id: true } });
    if (loop) {
      items.push({
        id: 'scan',
        icon: '🔍',
        text: `Scanning new gigs... ${matched} matches today`,
        time: 'live',
        type: 'scan',
        sort: Date.now(),
      });
    }

    // Queued
    if (queued > 0) {
      items.push({
        id: 'queue',
        icon: '⏳',
        text: `${queued} applications queued, sending soon`,
        time: 'now',
        type: 'match',
        sort: Date.now() - 1000,
      });
    }

    // Sent
    for (const app of sent) {
      items.push({
        id: `sent-${app.id}`,
        icon: '📨',
        text: `Sent to ${app.companyName} — ${app.jobTitle}`,
        time: ago(app.sentAt!),
        type: 'sent',
        sort: app.sentAt!.getTime(),
      });
    }

    // Opened
    for (const app of opened) {
      items.push({
        id: `open-${app.id}`,
        icon: '👁',
        text: `${app.companyName} opened your email`,
        time: ago(app.sentAt!),
        type: 'open',
        sort: app.sentAt!.getTime() + 1,
      });
    }

    // Replies
    for (const app of replies) {
      const emoji = app.replyCategory === 'INTERVIEW' ? '🟢' : '💬';
      items.push({
        id: `reply-${app.id}`,
        icon: emoji,
        text: app.replyCategory === 'INTERVIEW'
          ? `Interview invite from ${app.companyName}!`
          : `${app.companyName} replied to ${app.jobTitle}`,
        time: ago(app.repliedAt!),
        type: 'reply',
        sort: app.repliedAt!.getTime() + 2,
      });
    }

    // Sort by most recent first, limit to 12
    items.sort((a, b) => b.sort - a.sort);

    return NextResponse.json({ items: items.slice(0, 12) });
  } catch (error) {
    console.error('[ActivityFeed] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
