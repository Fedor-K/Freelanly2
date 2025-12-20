import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);

    // Fetch all stats in parallel
    const [
      totalJobs,
      activeJobs,
      todayJobs,
      weekJobs,
      totalCompanies,
      verifiedCompanies,
      totalSubscribers,
      activeSubscribers,
      totalImports,
      lastImport,
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
    ]);

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
        subscribers: {
          total: totalSubscribers,
          active: activeSubscribers,
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
