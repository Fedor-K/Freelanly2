import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setDate(monthStart.getDate() - 30);

    // Fetch all stats in parallel
    const [
      totalJobs,
      activeJobs,
      todayJobs,
      weekJobs,
      totalCompanies,
      verifiedCompanies,
      totalAlerts,
      activeAlerts,
      totalImports,
      lastImport,
      // User stats
      totalUsers,
      proUsers,
      usersWithStripe,
      newUsersWeek,
      newUsersMonth,
      // Revenue proxy (users with active subscriptions)
      activeSubscriptions,
    ] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { isActive: true } }),
      prisma.job.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.job.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.company.count(),
      prisma.company.count({ where: { verified: true } }),
      prisma.jobAlert.count(),
      prisma.jobAlert.count({ where: { isActive: true } }),
      prisma.importLog.count(),
      prisma.importLog.findFirst({
        orderBy: { startedAt: 'desc' },
      }),
      // User stats
      prisma.user.count(),
      prisma.user.count({ where: { plan: { in: ['PRO', 'ENTERPRISE'] } } }),
      prisma.user.count({ where: { stripeId: { not: null } } }),
      prisma.user.count({ where: { createdAt: { gte: weekStart } } }),
      prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
      prisma.user.count({
        where: {
          plan: { in: ['PRO', 'ENTERPRISE'] },
          subscriptionEndsAt: { gt: now },
        },
      }),
    ]);

    // Calculate conversion rate
    const conversionRate = totalUsers > 0 ? ((proUsers / totalUsers) * 100).toFixed(1) : '0';

    // Estimate MRR (rough calculation based on PRO users)
    // Weekly: €10, Monthly: €20, Annual: €192/12 = €16/month
    // Assume average of €18/month per PRO user
    const estimatedMRR = activeSubscriptions * 18;

    return NextResponse.json({
      success: true,
      stats: {
        jobs: {
          total: totalJobs,
          active: activeJobs,
          today: todayJobs,
          thisWeek: weekJobs,
        },
        companies: {
          total: totalCompanies,
          verified: verifiedCompanies,
        },
        alerts: {
          total: totalAlerts,
          active: activeAlerts,
        },
        users: {
          total: totalUsers,
          pro: proUsers,
          free: totalUsers - proUsers,
          withStripe: usersWithStripe,
          newThisWeek: newUsersWeek,
          newThisMonth: newUsersMonth,
          conversionRate: parseFloat(conversionRate),
        },
        revenue: {
          activeSubscriptions,
          estimatedMRR,
          estimatedARR: estimatedMRR * 12,
        },
        imports: {
          total: totalImports,
          lastRun: lastImport?.startedAt?.toISOString() || null,
          lastStatus: lastImport?.status || null,
          lastCreated: lastImport?.totalNew || 0,
          lastSkipped: lastImport?.totalSkipped || 0,
          lastFailed: lastImport?.totalFailed || 0,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics', details: String(error) },
      { status: 500 }
    );
  }
}
