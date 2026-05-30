import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/opportunities/[id]/signals
 * Returns signal strength data for a project page:
 * - How many applied so far
 * - When posted (freshness)
 * - Trending rank (views/applies today)
 * - Similar projects count
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const opportunity = await prisma.opportunity.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        skills: true,
        createdAt: true,
        category: { select: { slug: true } },
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // How many applied
    const applicantCount = await prisma.autoApplication.count({
      where: { opportunityId: id },
    });

    // Freshness
    const postedMinutesAgo = Math.round((Date.now() - opportunity.createdAt.getTime()) / 60000);
    let freshness: string;
    if (postedMinutesAgo < 60) freshness = `${postedMinutesAgo} minutes ago`;
    else if (postedMinutesAgo < 1440) freshness = `${Math.round(postedMinutesAgo / 60)} hours ago`;
    else freshness = `${Math.round(postedMinutesAgo / 1440)} days ago`;

    const isFresh = postedMinutesAgo < 360; // under 6 hours

    // Similar projects count (same skills, active, with email)
    const similarCount = await prisma.opportunity.count({
      where: {
        isActive: true,
        applyEmail: { not: null },
        id: { not: id },
        skills: { hasSome: opportunity.skills.slice(0, 3) },
      },
    });

    // Trending: count applies today across category
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const categoryApplies = await prisma.autoApplication.count({
      where: {
        createdAt: { gte: todayStart },
        // AutoApplication has no Opportunity relation (only opportunityId); the previous
        // `opportunity: { categoryId: … }` filter was a no-op (both branches undefined).
      },
    });

    // Total active projects with email
    const totalProjects = await prisma.opportunity.count({
      where: { isActive: true, applyEmail: { not: null } },
    });

    // Build signals
    const signals: { icon: string; text: string; strong: boolean }[] = [];

    if (isFresh) {
      signals.push({
        icon: 'fresh',
        text: `Just posted — ${freshness}. Under ${Math.max(applicantCount, 5)} applications so far.`,
        strong: true,
      });
    }

    if (opportunity.skills.length >= 3) {
      const avgPerWeek = Math.max(1, Math.round(similarCount / 4));
      signals.push({
        icon: 'rare',
        text: `Specialized role. ${opportunity.skills.slice(0, 2).join(' + ')} roles average ${avgPerWeek} listings/week.`,
        strong: true,
      });
    }

    if (applicantCount < 20) {
      signals.push({
        icon: 'competition',
        text: `Low competition window. ${applicantCount || 'Few'} applications so far — typically reaches 100+ within 48h.`,
        strong: true,
      });
    }

    if (!isFresh && postedMinutesAgo < 4320) { // under 3 days
      signals.push({
        icon: 'active',
        text: `Still active — posted ${freshness}, position likely still open.`,
        strong: false,
      });
    }

    return NextResponse.json({
      signals,
      stats: {
        applicantCount,
        postedMinutesAgo,
        freshness,
        isFresh,
        similarCount,
        totalProjects,
      },
    });
  } catch (error) {
    console.error('[Signals] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
