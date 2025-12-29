import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Search
    const search = searchParams.get('search') || '';

    // Filters
    const planFilter = searchParams.get('plan'); // FREE, PRO, ENTERPRISE
    const hasAlerts = searchParams.get('hasAlerts'); // true, false
    const hasStripe = searchParams.get('hasStripe'); // true, false

    // Build where clause
    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (planFilter && ['FREE', 'PRO', 'ENTERPRISE'].includes(planFilter)) {
      where.plan = planFilter;
    }

    if (hasAlerts === 'true') {
      where.jobAlerts = { some: {} };
    } else if (hasAlerts === 'false') {
      where.jobAlerts = { none: {} };
    }

    if (hasStripe === 'true') {
      where.stripeId = { not: null };
    } else if (hasStripe === 'false') {
      where.stripeId = null;
    }

    // Get date ranges for stats
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get total count for pagination
    const totalUsers = await prisma.user.count({ where });

    // Get users with pagination
    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        stripeId: true,
        stripeSubscriptionId: true,
        subscriptionEndsAt: true,
        createdAt: true,
        emailVerified: true,
        _count: {
          select: {
            jobAlerts: true,
            applications: true,
          },
        },
        jobAlerts: {
          select: {
            id: true,
            category: true,
            keywords: true,
            frequency: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                notifications: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        sessions: {
          select: {
            id: true,
            expires: true,
          },
          orderBy: { expires: 'desc' },
          take: 5,
        },
      },
    });

    // Calculate stats for each user
    const usersWithStats = users.map(user => {
      const activeSessions = user.sessions.filter(s => new Date(s.expires) > now);
      const lastSession = user.sessions[0];
      const totalNotificationsSent = user.jobAlerts.reduce(
        (sum, alert) => sum + alert._count.notifications,
        0
      );
      const activeAlerts = user.jobAlerts.filter(a => a.isActive).length;

      return {
        ...user,
        stats: {
          lastLoginAt: lastSession ? lastSession.expires : null,
          activeSessions: activeSessions.length,
          activeAlerts,
          totalAlerts: user.jobAlerts.length,
          totalNotificationsSent,
          applications: user._count.applications,
        },
      };
    });

    // Calculate overall stats (for all users, not just current page)
    const [allUsers, proCount, activeIn7Days, activeIn30Days, newIn7Days, newIn30Days] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { plan: { in: ['PRO', 'ENTERPRISE'] } } }),
      prisma.user.count({
        where: {
          sessions: { some: { expires: { gt: sevenDaysAgo } } },
        },
      }),
      prisma.user.count({
        where: {
          sessions: { some: { expires: { gt: thirtyDaysAgo } } },
        },
      }),
      prisma.user.count({ where: { createdAt: { gt: sevenDaysAgo } } }),
      prisma.user.count({ where: { createdAt: { gt: thirtyDaysAgo } } }),
    ]);

    const overallStats = {
      totalUsers: allUsers,
      proUsers: proCount,
      freeUsers: allUsers - proCount,
      conversionRate: allUsers > 0 ? parseFloat(((proCount / allUsers) * 100).toFixed(1)) : 0,
      activeUsersLast7Days: activeIn7Days,
      activeUsersLast30Days: activeIn30Days,
      newUsersLast7Days: newIn7Days,
      newUsersLast30Days: newIn30Days,
    };

    return NextResponse.json({
      success: true,
      users: usersWithStats,
      overallStats,
      pagination: {
        page,
        limit,
        total: totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: String(error) },
      { status: 500 }
    );
  }
}
