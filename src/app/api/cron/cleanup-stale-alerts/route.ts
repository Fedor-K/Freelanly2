import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/cron/cleanup-stale-alerts
 *
 * Deactivates job alerts for users who haven't been active in 30+ days.
 * Runs daily via Vercel cron.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Find users inactive for 30+ days who still have active alerts
    const staleUsers = await prisma.user.findMany({
      where: {
        emailVerified: { not: null },
        unsubscribedFromMarketing: false,
        OR: [
          { lastActiveAt: null },
          { lastActiveAt: { lt: thirtyDaysAgo } },
        ],
        jobAlerts: { some: { isActive: true } },
      },
      select: { id: true },
    });

    if (staleUsers.length === 0) {
      console.log('[CleanupAlerts] No stale alerts to deactivate');
      return NextResponse.json({ deactivated: 0, users: 0 });
    }

    const userIds = staleUsers.map(u => u.id);

    // Deactivate their alerts
    const result = await prisma.jobAlert.updateMany({
      where: {
        userId: { in: userIds },
        isActive: true,
      },
      data: { isActive: false },
    });

    console.log(`[CleanupAlerts] Deactivated ${result.count} alerts for ${staleUsers.length} stale users (30+ days inactive)`);

    return NextResponse.json({
      deactivated: result.count,
      users: staleUsers.length,
    });
  } catch (error) {
    console.error('[CleanupAlerts] Error:', error);
    return NextResponse.json({ error: 'Failed to cleanup alerts' }, { status: 500 });
  }
}
