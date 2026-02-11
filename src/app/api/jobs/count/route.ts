import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/jobs/count
 * Returns job + opportunity count for given criteria (for alert preview)
 *
 * Query params:
 * - category: category slug (optional)
 * - country: country code (optional)
 * - days: number of days to look back (default 7)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const country = searchParams.get('country');
    const days = parseInt(searchParams.get('days') || '7');

    const dateFilter = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Build where clause (same structure for both Job and Opportunity)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      isActive: true,
      postedAt: { gte: dateFilter },
    };

    if (category) {
      where.category = { slug: category };
    }

    if (country) {
      where.country = country;
    }

    // Count both jobs and opportunities
    const [jobCount, oppCount] = await Promise.all([
      prisma.job.count({ where }),
      prisma.opportunity.count({ where }),
    ]);
    const count = jobCount + oppCount;

    // Also get count without country filter for comparison
    let countWithoutCountry = count;
    if (country) {
      const whereWithoutCountry = { ...where };
      delete whereWithoutCountry.country;
      const [jobCountNoCountry, oppCountNoCountry] = await Promise.all([
        prisma.job.count({ where: whereWithoutCountry }),
        prisma.opportunity.count({ where: whereWithoutCountry }),
      ]);
      countWithoutCountry = jobCountNoCountry + oppCountNoCountry;
    }

    // Calculate daily average
    const dailyAverage = Math.round((count / days) * 10) / 10;

    return NextResponse.json({
      count,
      countWithoutCountry,
      dailyAverage,
      days,
      filters: {
        category: category || 'all',
        country: country || 'worldwide',
      },
    });
  } catch (error) {
    console.error('Error counting jobs:', error);
    return NextResponse.json(
      { error: 'Failed to count jobs' },
      { status: 500 }
    );
  }
}
