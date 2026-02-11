import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/jobs/count
 * Returns job + opportunity count for given criteria (for alert preview)
 *
 * Query params:
 * - category: category slug (optional)
 * - country: country code (optional)
 * - languages: comma-separated language codes, e.g. "ES,FR" (optional, filters by source/target)
 * - days: number of days to look back (default 7)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const country = searchParams.get('country');
    const languagesParam = searchParams.get('languages');
    const days = parseInt(searchParams.get('days') || '7');

    const dateFilter = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const langCodes = languagesParam ? languagesParam.split(',').map(l => l.trim().toUpperCase()).filter(Boolean) : [];

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

    // Filter by languages: job must have at least one of the selected languages
    // in either sourceLanguages or targetLanguages
    if (langCodes.length > 0) {
      where.OR = [
        { sourceLanguages: { hasSome: langCodes } },
        { targetLanguages: { hasSome: langCodes } },
      ];
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
