import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

function timeAgo(date: Date): string {
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
    const weekAgo = new Date(Date.now() - 7 * 86400000);

    // Recent replies
    const replies = await prisma.autoApplication.findMany({
      where: { userId, status: { in: ['REPLIED', 'INTERVIEW', 'REJECTED'] }, repliedAt: { gte: weekAgo } },
      orderBy: { repliedAt: 'desc' },
      take: 10,
      select: { id: true, companyName: true, jobTitle: true, replyCategory: true, repliedAt: true },
    });

    // Recently sent
    const sent = await prisma.autoApplication.findMany({
      where: { userId, sentAt: { gte: dayAgo }, status: { in: ['SENT', 'DELIVERED', 'OPENED'] } },
      orderBy: { sentAt: 'desc' },
      take: 5,
      select: { id: true, companyName: true, jobTitle: true, status: true, sentAt: true },
    });

    // Recently opened
    const opened = await prisma.autoApplication.findMany({
      where: { userId, status: 'OPENED', sentAt: { gte: weekAgo } },
      orderBy: { sentAt: 'desc' },
      take: 5,
      select: { id: true, companyName: true, jobTitle: true, sentAt: true },
    });

    const items = [
      ...replies.map(r => ({
        id: `reply-${r.id}`,
        type: 'reply',
        title: r.replyCategory === 'INTERVIEW' ? `Interview invite from ${r.companyName}` :
               r.replyCategory === 'REJECTED' ? `${r.companyName} passed` :
               `${r.companyName} replied`,
        subtitle: r.jobTitle,
        time: r.repliedAt ? timeAgo(r.repliedAt) : '',
        sort: r.repliedAt?.getTime() || 0,
      })),
      ...opened.map(o => ({
        id: `opened-${o.id}`,
        type: 'opened',
        title: `${o.companyName} opened your email`,
        subtitle: o.jobTitle,
        time: o.sentAt ? timeAgo(o.sentAt) : '',
        sort: o.sentAt?.getTime() || 0,
      })),
      ...sent.map(s => ({
        id: `sent-${s.id}`,
        type: 'sent',
        title: `Application sent to ${s.companyName}`,
        subtitle: s.jobTitle,
        time: s.sentAt ? timeAgo(s.sentAt) : '',
        sort: s.sentAt?.getTime() || 0,
      })),
    ].sort((a, b) => b.sort - a.sort).slice(0, 15);

    const unread = replies.filter(r => r.repliedAt && r.repliedAt >= dayAgo).length;

    return NextResponse.json({ items, unread });
  } catch (error) {
    console.error('[Notifications] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
