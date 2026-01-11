import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

export async function GET() {
  // Check admin access
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get all FREE users with verified email
    const [
      totalFreeUsers,
      freeUsers7d,
      freeUsers30d,
      freeUsersWithAttempts,
      convertedToPro30d,
      totalApplyAttempts,
    ] = await Promise.all([
      // Total FREE users with verified email
      prisma.user.count({
        where: {
          plan: 'FREE',
          emailVerified: { not: null },
        },
      }),
      // FREE users registered in last 7 days
      prisma.user.count({
        where: {
          plan: 'FREE',
          emailVerified: { not: null },
          createdAt: { gte: sevenDaysAgo },
        },
      }),
      // FREE users registered in last 30 days
      prisma.user.count({
        where: {
          plan: 'FREE',
          emailVerified: { not: null },
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      // FREE users who tried to apply (have ApplyAttempt)
      prisma.user.count({
        where: {
          plan: 'FREE',
          emailVerified: { not: null },
          applyAttempts: { some: {} },
        },
      }),
      // Users who converted from FREE to PRO in last 30 days
      prisma.user.count({
        where: {
          plan: 'PRO',
          proStartedAt: { gte: thirtyDaysAgo },
        },
      }),
      // Total apply attempts from FREE users
      prisma.applyAttempt.count({
        where: {
          user: { plan: 'FREE' },
        },
      }),
    ]);

    // Email funnel stats (30 days)
    const [
      sentWelcome,
      sentDay3,
      sentDay7,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          plan: 'FREE',
          emailVerified: { not: null },
          createdAt: { gte: thirtyDaysAgo },
          freeNurtureEmailsSent: { gte: 1 },
        },
      }),
      prisma.user.count({
        where: {
          plan: 'FREE',
          emailVerified: { not: null },
          createdAt: { gte: thirtyDaysAgo },
          freeNurtureEmailsSent: { gte: 2 },
        },
      }),
      prisma.user.count({
        where: {
          plan: 'FREE',
          emailVerified: { not: null },
          createdAt: { gte: thirtyDaysAgo },
          freeNurtureEmailsSent: { gte: 3 },
        },
      }),
    ]);

    // Funnel data
    const funnel = {
      registered7d: freeUsers7d,
      registered30d: freeUsers30d,
      triedToApply: freeUsersWithAttempts,
      convertedToPro: convertedToPro30d,
    };

    // Email funnel
    const emailFunnel = {
      sentWelcome,
      sentDay3,
      sentDay7,
    };

    // Calculate conversion rate
    const conversionRate = freeUsers30d > 0
      ? Math.round((convertedToPro30d / freeUsers30d) * 100)
      : 0;

    // Get recent FREE users for the table
    const recentFreeUsers = await prisma.user.findMany({
      where: {
        plan: 'FREE',
        emailVerified: { not: null },
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        emailVerified: true,
        lastActiveAt: true,
        freeNurtureEmailsSent: true,
        _count: {
          select: {
            applyAttempts: true,
            jobAlerts: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get users who recently converted to PRO (for tracking success)
    const recentlyConverted = await prisma.user.findMany({
      where: {
        plan: 'PRO',
        proStartedAt: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
        proStartedAt: true,
      },
      orderBy: { proStartedAt: 'desc' },
      take: 20,
    });

    // Calculate days from registration to conversion for converted users
    let avgDaysToConvert = 0;
    if (recentlyConverted.length > 0) {
      const totalDays = recentlyConverted.reduce((sum, user) => {
        if (user.createdAt && user.proStartedAt) {
          const days = (user.proStartedAt.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }
        return sum;
      }, 0);
      avgDaysToConvert = Math.round((totalDays / recentlyConverted.length) * 10) / 10;
    }

    // Transform users for table with status
    const tableUsers = recentFreeUsers.map((user) => {
      const daysSinceRegistration = Math.floor(
        (now.getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysSinceActive = user.lastActiveAt
        ? Math.floor((now.getTime() - user.lastActiveAt.getTime()) / (1000 * 60 * 60 * 24))
        : daysSinceRegistration;

      // Determine status
      let status: 'new' | 'active' | 'interested' | 'high-intent' | 'lapsed';
      const applyAttempts = user._count.applyAttempts;

      if (applyAttempts >= 3) {
        status = 'high-intent';
      } else if (applyAttempts >= 1) {
        status = 'interested';
      } else if (daysSinceActive >= 14) {
        status = 'lapsed';
      } else if (daysSinceRegistration <= 3) {
        status = 'new';
      } else {
        status = 'active';
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
        emailVerified: user.emailVerified?.toISOString(),
        lastActiveAt: user.lastActiveAt?.toISOString(),
        applyAttempts,
        alertsSetup: user._count.jobAlerts,
        emailsSent: user.freeNurtureEmailsSent,
        daysSinceRegistration,
        daysSinceActive,
        status,
      };
    });

    // Count by status
    const statusCounts = {
      new: tableUsers.filter(u => u.status === 'new').length,
      active: tableUsers.filter(u => u.status === 'active').length,
      interested: tableUsers.filter(u => u.status === 'interested').length,
      highIntent: tableUsers.filter(u => u.status === 'high-intent').length,
      lapsed: tableUsers.filter(u => u.status === 'lapsed').length,
    };

    return NextResponse.json({
      summary: {
        totalFreeUsers,
        freeUsers7d,
        freeUsers30d,
        freeUsersWithAttempts,
        convertedToPro30d,
        conversionRate,
        avgDaysToConvert,
        totalApplyAttempts,
      },
      funnel,
      emailFunnel,
      statusCounts,
      users: tableUsers,
    });
  } catch (error) {
    console.error('[Admin Free Nurture Stats] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
