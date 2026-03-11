import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';
import { getActivationStats, ACTIVATION_TARGET, ACTIVATION_WINDOW_DAYS } from '@/services/activation-emails';

export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  try {
    const now = new Date();
    const windowStart = new Date(now.getTime() - ACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get activation stats from service
    const stats = await getActivationStats();

    // Get all PRO users who started in the last 30 days for the table
    const recentProUsers = await prisma.user.findMany({
      where: {
        plan: 'PRO',
        proStartedAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        email: true,
        name: true,
        proStartedAt: true,
        activatedAt: true,
        activationEmailsSent: true,
        _count: {
          select: { applications: true },
        },
      },
      orderBy: { proStartedAt: 'desc' },
      take: 50,
    });

    // Calculate funnel metrics
    const funnelData = {
      subscribed7d: await prisma.user.count({
        where: {
          plan: 'PRO',
          proStartedAt: { gte: sevenDaysAgo },
        },
      }),
      subscribed30d: await prisma.user.count({
        where: {
          plan: 'PRO',
          proStartedAt: { gte: thirtyDaysAgo },
        },
      }),
      sentWelcome: await prisma.user.count({
        where: {
          plan: 'PRO',
          proStartedAt: { gte: thirtyDaysAgo },
          activationEmailsSent: { gte: 1 },
        },
      }),
      sentDay1: await prisma.user.count({
        where: {
          plan: 'PRO',
          proStartedAt: { gte: thirtyDaysAgo },
          activationEmailsSent: { gte: 2 },
        },
      }),
      sentDay2: await prisma.user.count({
        where: {
          plan: 'PRO',
          proStartedAt: { gte: thirtyDaysAgo },
          activationEmailsSent: { gte: 3 },
        },
      }),
      sentDay3: await prisma.user.count({
        where: {
          plan: 'PRO',
          proStartedAt: { gte: thirtyDaysAgo },
          activationEmailsSent: { gte: 4 },
        },
      }),
      activated30d: await prisma.user.count({
        where: {
          plan: 'PRO',
          proStartedAt: { gte: thirtyDaysAgo },
          activatedAt: { not: null },
        },
      }),
    };

    // Calculate average days to first application for activated users
    const activatedUsers = await prisma.user.findMany({
      where: {
        plan: 'PRO',
        proStartedAt: { gte: thirtyDaysAgo },
        activatedAt: { not: null },
      },
      select: {
        proStartedAt: true,
        activatedAt: true,
      },
    });

    let avgDaysToActivate = 0;
    if (activatedUsers.length > 0) {
      const totalDays = activatedUsers.reduce((sum, user) => {
        if (user.proStartedAt && user.activatedAt) {
          const days = (user.activatedAt.getTime() - user.proStartedAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }
        return sum;
      }, 0);
      avgDaysToActivate = Math.round((totalDays / activatedUsers.length) * 10) / 10;
    }

    // Count users by activation status
    const usersInWindow = await prisma.user.findMany({
      where: {
        plan: 'PRO',
        proStartedAt: { gte: windowStart },
        activatedAt: null,
      },
      select: {
        id: true,
        proStartedAt: true,
        _count: { select: { applications: true } },
      },
    });

    // Transform recent users for table
    const tableUsers = recentProUsers.map((user) => {
      const applicationCount = user._count.applications;
      const daysSinceStart = user.proStartedAt
        ? Math.floor((now.getTime() - user.proStartedAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      let status: 'activated' | 'pending' | 'at-risk' | 'churned';
      if (user.activatedAt || applicationCount >= ACTIVATION_TARGET) {
        status = 'activated';
      } else if (daysSinceStart >= ACTIVATION_WINDOW_DAYS) {
        status = applicationCount > 0 ? 'at-risk' : 'churned';
      } else if (daysSinceStart >= 5 && applicationCount === 0) {
        status = 'at-risk';
      } else {
        status = 'pending';
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        proStartedAt: user.proStartedAt?.toISOString(),
        activatedAt: user.activatedAt?.toISOString(),
        applications: applicationCount,
        emailsSent: user.activationEmailsSent,
        daysSinceStart,
        status,
      };
    });

    return NextResponse.json({
      summary: {
        ...stats,
        avgDaysToActivate,
        activationTarget: ACTIVATION_TARGET,
        activationWindowDays: ACTIVATION_WINDOW_DAYS,
      },
      funnel: funnelData,
      users: tableUsers,
    });
  } catch (error) {
    console.error('[Admin Activation Stats] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
