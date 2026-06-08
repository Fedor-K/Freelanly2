import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const PIPELINE_STAGES = ['SENT', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'] as const;

/**
 * GET /api/user/pipeline — Kanban board data
 * Returns applications grouped by status with KPIs
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = session.user.id;
    const view = request.nextUrl.searchParams.get('view') || 'board';

    // Get all active applications (not PENDING/FAILED/SKIPPED)
    const applications = await prisma.autoApplication.findMany({
      where: {
        userId,
        // REJECTED is a real recruiter "not a fit" ONLY when it came from a reply.
        // The matcher writes phantom REJECTED rows (never sent, no reply) for every
        // candidate it declines — those must never surface as the user's rejections.
        OR: [
          { status: { in: ['SENT', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'] } },
          { status: 'REJECTED', repliedAt: { not: null } },
        ],
      },
      select: {
        id: true,
        companyName: true,
        jobTitle: true,
        appliedToEmail: true,
        status: true,
        matchScore: true,
        matchLabel: true,
        sentAt: true,
        repliedAt: true,
        replyText: true,
        replyCategory: true,
        followUpSentAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Group by stage
    const stages = PIPELINE_STAGES.map(stage => ({
      stage,
      count: applications.filter(a => a.status === stage).length,
      items: applications
        .filter(a => a.status === stage)
        .slice(0, view === 'board' ? 10 : 50)
        .map(a => ({
          id: a.id,
          companyName: a.companyName,
          jobTitle: a.jobTitle,
          matchScore: a.matchScore,
          sentAt: a.sentAt,
          repliedAt: a.repliedAt,
          replyPreview: a.replyText?.slice(0, 60) || null,
          replyCategory: a.replyCategory,
          followUpSent: !!a.followUpSentAt,
          updatedAt: a.updatedAt,
        })),
    }));

    // Also include rejected
    const rejected = applications.filter(a => a.status === 'REJECTED');

    // KPIs
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recent = applications.filter(a => a.sentAt && a.sentAt >= thirtyDaysAgo);
    const recentReplied = recent.filter(a => ['REPLIED', 'INTERVIEW', 'OFFER'].includes(a.status));

    return NextResponse.json({
      stages,
      rejected: { count: rejected.length },
      kpis: {
        activeConversations: applications.filter(a => ['REPLIED', 'INTERVIEW'].includes(a.status)).length,
        replyRate30d: recent.length > 0 ? Math.round((recentReplied.length / recent.length) * 1000) / 10 : 0,
        totalSent: applications.length,
      },
    });
  } catch (error) {
    console.error('[Pipeline] GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

/**
 * PATCH /api/user/pipeline — Move application between stages
 * Body: { applicationId, newStatus }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { applicationId, newStatus } = await request.json();

    if (!applicationId || !PIPELINE_STAGES.includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid applicationId or status' }, { status: 400 });
    }

    const app = await prisma.autoApplication.findFirst({
      where: { id: applicationId, userId: session.user.id },
    });

    if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.autoApplication.update({
      where: { id: applicationId },
      data: { status: newStatus as any },
    });

    return NextResponse.json({ ok: true, id: applicationId, status: newStatus });
  } catch (error) {
    console.error('[Pipeline] PATCH error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
