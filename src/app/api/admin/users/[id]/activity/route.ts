import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/users/[id]/activity
 *
 * Returns activity timeline for a specific user.
 * Query params:
 *   - limit: number (default 100, max 500)
 *   - offset: number (default 0)
 *   - action: ActivityAction filter (optional)
 *   - from: ISO date string (optional)
 *   - to: ISO date string (optional)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const offset = parseInt(searchParams.get('offset') || '0');
    const actionFilter = searchParams.get('action') as ActivityAction | null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        createdAt: true,
        lastActiveAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Build where clause
    const where: Record<string, unknown> = { userId: id };
    if (actionFilter && Object.values(ActivityAction).includes(actionFilter)) {
      where.action = actionFilter;
    }
    if (from || to) {
      where.createdAt = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      };
    }

    // Get activities and total count in parallel
    const [activities, totalCount, actionCounts] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where }),
      prisma.activityLog.groupBy({
        by: ['action'],
        where: { userId: id },
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),
    ]);

    return NextResponse.json({
      user,
      activities,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
      summary: {
        totalActions: actionCounts.reduce((sum, a) => sum + a._count.action, 0),
        byAction: Object.fromEntries(
          actionCounts.map((a) => [a.action, a._count.action])
        ),
      },
    });
  } catch (error) {
    console.error('[Admin/UserActivity] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
