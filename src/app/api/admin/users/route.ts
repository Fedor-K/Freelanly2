import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    // Get date ranges
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
        stripeId: true,
        stripeSubscriptionId: true,
        subscriptionEndsAt: true,
        createdAt: true,
        _count: {
          select: {
            savedJobs: true,
            jobAlerts: true,
          },
        },
        // Include job alerts with details
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
        // Include sessions for login tracking
        sessions: {
          select: {
            id: true,
            expires: true,
          },
          orderBy: { expires: 'desc' },
          take: 10,
        },
      },
    });

    // Calculate stats for each user
    const usersWithStats = users.map(user => {
      // Count active sessions (not expired)
      const activeSessions = user.sessions.filter(s => new Date(s.expires) > now);
      const lastSession = user.sessions[0];

      // Calculate total notifications sent
      const totalNotificationsSent = user.jobAlerts.reduce(
        (sum, alert) => sum + alert._count.notifications,
        0
      );

      // Active alerts count
      const activeAlerts = user.jobAlerts.filter(a => a.isActive).length;

      return {
        ...user,
        stats: {
          lastLoginAt: lastSession ? lastSession.expires : null,
          activeSessions: activeSessions.length,
          activeAlerts,
          totalAlerts: user.jobAlerts.length,
          totalNotificationsSent,
        },
      };
    });

    // Calculate overall stats
    const totalUsers = users.length;
    const proUsers = users.filter(u => u.plan === 'PRO' || u.plan === 'ENTERPRISE').length;
    const freeUsers = users.filter(u => u.plan === 'FREE').length;

    // Active users (have sessions in last 7/30 days)
    const activeUsersLast7Days = users.filter(u =>
      u.sessions.some(s => new Date(s.expires) > sevenDaysAgo)
    ).length;
    const activeUsersLast30Days = users.filter(u =>
      u.sessions.some(s => new Date(s.expires) > thirtyDaysAgo)
    ).length;

    // Conversion rate (users who were FREE and are now PRO)
    const conversionRate = totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(1) : '0';

    // New users last 7/30 days
    const newUsersLast7Days = users.filter(u =>
      new Date(u.createdAt) > sevenDaysAgo
    ).length;
    const newUsersLast30Days = users.filter(u =>
      new Date(u.createdAt) > thirtyDaysAgo
    ).length;

    const overallStats = {
      totalUsers,
      proUsers,
      freeUsers,
      conversionRate: parseFloat(conversionRate),
      activeUsersLast7Days,
      activeUsersLast30Days,
      newUsersLast7Days,
      newUsersLast30Days,
    };

    return NextResponse.json({
      success: true,
      users: usersWithStats,
      overallStats,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: String(error) },
      { status: 500 }
    );
  }
}
