import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  // Verify admin secret
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.CRON_SECRET; // Reuse CRON_SECRET for admin

  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.cookieConsent.count();

    // Get consents with user info
    const consents = await prisma.cookieConsent.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: { consentedAt: 'desc' },
      skip,
      take: limit,
    });

    // Get stats
    const stats = await prisma.cookieConsent.aggregate({
      _count: { id: true },
    });

    const analyticsAccepted = await prisma.cookieConsent.count({
      where: { analytics: true },
    });

    const marketingAccepted = await prisma.cookieConsent.count({
      where: { marketing: true },
    });

    const preferencesAccepted = await prisma.cookieConsent.count({
      where: { preferences: true },
    });

    // Users vs anonymous
    const withUserId = await prisma.cookieConsent.count({
      where: { userId: { not: null } },
    });

    return NextResponse.json({
      consents: consents.map((c) => ({
        id: c.id,
        user: c.user
          ? { id: c.user.id, email: c.user.email, name: c.user.name }
          : null,
        visitorId: c.visitorId,
        necessary: c.necessary,
        analytics: c.analytics,
        marketing: c.marketing,
        preferences: c.preferences,
        version: c.version,
        ipAddress: c.ipAddress,
        consentedAt: c.consentedAt,
        updatedAt: c.updatedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      stats: {
        total: stats._count.id,
        analyticsAccepted,
        marketingAccepted,
        preferencesAccepted,
        registeredUsers: withUserId,
        anonymous: total - withUserId,
        analyticsRate: total > 0 ? ((analyticsAccepted / total) * 100).toFixed(1) : 0,
        marketingRate: total > 0 ? ((marketingAccepted / total) * 100).toFixed(1) : 0,
      },
    });
  } catch (error) {
    console.error('[Admin CookieConsents] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get consents' },
      { status: 500 }
    );
  }
}
