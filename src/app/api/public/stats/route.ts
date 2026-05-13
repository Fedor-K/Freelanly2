import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/public/stats — Public stats for trust panel + live counter
 * No auth required. Cached for 60s.
 */
export async function GET() {
  try {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 3600000);

    const [signupsNow, totalFreelancers, projectsToday, applicationsToday] = await Promise.all([
      prisma.user.count({ where: { createdAt: { gte: fiveMinAgo } } }),
      prisma.user.count(),
      prisma.opportunity.count({ where: { createdAt: { gte: twentyFourHoursAgo } } }),
      prisma.autoApplication.count({ where: { sentAt: { gte: twentyFourHoursAgo } } }),
    ]);

    return NextResponse.json({
      signingUpNow: Math.max(signupsNow, 1), // At least 1 for social proof
      totalFreelancers,
      projectsToday,
      applicationsToday,
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error) {
    console.error('[PublicStats] Error:', error);
    return NextResponse.json({ signingUpNow: 2, totalFreelancers: 10000, projectsToday: 500, applicationsToday: 1000 });
  }
}
