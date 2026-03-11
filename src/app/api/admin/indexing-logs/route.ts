import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';

/**
 * Check indexing logs
 * GET /api/admin/indexing-logs
 */
export async function GET(request: NextRequest) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  try {
    // Get recent indexing logs
    const recentLogs = await prisma.indexingLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Get stats by provider (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [googleStats, indexNowStats] = await Promise.all([
      prisma.indexingLog.aggregate({
        where: {
          provider: 'GOOGLE',
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { urlsCount: true, success: true, failed: true },
        _count: true,
      }),
      prisma.indexingLog.aggregate({
        where: {
          provider: 'INDEXNOW',
          createdAt: { gte: thirtyDaysAgo },
        },
        _sum: { urlsCount: true, success: true, failed: true },
        _count: true,
      }),
    ]);

    // Get daily breakdown (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyLogs = await prisma.indexingLog.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'asc' },
    });

    // Group by day
    const dailyBreakdown: Record<string, { google: number; indexNow: number }> = {};
    for (const log of dailyLogs) {
      const day = log.createdAt.toISOString().slice(0, 10);
      if (!dailyBreakdown[day]) {
        dailyBreakdown[day] = { google: 0, indexNow: 0 };
      }
      if (log.provider === 'GOOGLE') {
        dailyBreakdown[day].google += log.success;
      } else {
        dailyBreakdown[day].indexNow += log.success;
      }
    }

    // Get errors
    const recentErrors = await prisma.indexingLog.findMany({
      where: {
        error: { not: null },
        createdAt: { gte: sevenDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Check if submit-to-index cron was ever called
    const lastSubmitToIndex = await prisma.indexingLog.findFirst({
      where: {
        urlsCount: { gte: 100 }, // Batch submissions are 100+
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,

      // 30-day stats
      stats30d: {
        google: {
          requests: googleStats._count,
          urlsSubmitted: googleStats._sum.urlsCount || 0,
          success: googleStats._sum.success || 0,
          failed: googleStats._sum.failed || 0,
        },
        indexNow: {
          requests: indexNowStats._count,
          urlsSubmitted: indexNowStats._sum.urlsCount || 0,
          success: indexNowStats._sum.success || 0,
          failed: indexNowStats._sum.failed || 0,
        },
      },

      // Daily breakdown
      dailyBreakdown,

      // Recent errors
      recentErrors: recentErrors.map(e => ({
        provider: e.provider,
        error: e.error,
        urlsCount: e.urlsCount,
        date: e.createdAt.toISOString(),
      })),

      // Last batch submission (submit-to-index cron)
      lastBatchSubmission: lastSubmitToIndex ? {
        date: lastSubmitToIndex.createdAt.toISOString(),
        provider: lastSubmitToIndex.provider,
        urlsCount: lastSubmitToIndex.urlsCount,
        success: lastSubmitToIndex.success,
      } : null,

      // Recent logs
      recentLogs: recentLogs.map(l => ({
        provider: l.provider,
        urlsCount: l.urlsCount,
        success: l.success,
        failed: l.failed,
        error: l.error,
        date: l.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('[IndexingLogs] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
