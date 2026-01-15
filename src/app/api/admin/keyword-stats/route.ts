/**
 * Admin API: Keyword Run Statistics
 *
 * GET /api/admin/keyword-stats
 * Returns keyword run history with stats on posts received/processed and opportunities created
 *
 * Query params:
 * - page: Page number (default 1)
 * - limit: Items per page (default 50)
 * - keyword: Filter by specific keyword
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const keywordFilter = request.nextUrl.searchParams.get('keyword');

    const skip = (page - 1) * limit;

    // Build where clause
    const where = keywordFilter ? { keyword: { contains: keywordFilter } } : {};

    // Fetch keyword runs with opportunities
    const [runs, total, aggregateStats] = await Promise.all([
      prisma.keywordRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          opportunities: {
            select: {
              id: true,
              title: true,
              clientName: true,
              category: { select: { name: true } },
              contentQuality: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 10, // Show last 10 opportunities per run
          },
          _count: {
            select: { opportunities: true },
          },
        },
      }),
      prisma.keywordRun.count({ where }),
      // Aggregate stats for the dashboard
      prisma.keywordRun.aggregate({
        _sum: {
          postsReceived: true,
          postsProcessed: true,
          opportunitiesCreated: true,
        },
        _count: true,
      }),
    ]);

    // Get keyword performance summary (top performing keywords)
    const keywordSummary = await prisma.keywordRun.groupBy({
      by: ['keyword'],
      _sum: {
        postsReceived: true,
        postsProcessed: true,
        opportunitiesCreated: true,
      },
      _count: true,
      orderBy: {
        _sum: {
          opportunitiesCreated: 'desc',
        },
      },
      take: 20,
    });

    // Calculate conversion rates
    const runsWithConversion = runs.map((run) => ({
      ...run,
      conversionRate:
        run.postsReceived > 0
          ? ((run.opportunitiesCreated / run.postsReceived) * 100).toFixed(1)
          : '0.0',
      validationRate:
        run.postsReceived > 0
          ? ((run.postsProcessed / run.postsReceived) * 100).toFixed(1)
          : '0.0',
    }));

    return NextResponse.json({
      success: true,
      runs: runsWithConversion,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      // Summary stats
      summary: {
        totalRuns: aggregateStats._count,
        totalPostsReceived: aggregateStats._sum.postsReceived || 0,
        totalPostsProcessed: aggregateStats._sum.postsProcessed || 0,
        totalOpportunitiesCreated: aggregateStats._sum.opportunitiesCreated || 0,
        overallConversionRate:
          aggregateStats._sum.postsReceived && aggregateStats._sum.postsReceived > 0
            ? (
                ((aggregateStats._sum.opportunitiesCreated || 0) /
                  aggregateStats._sum.postsReceived) *
                100
              ).toFixed(1)
            : '0.0',
      },
      // Top performing keywords
      keywordPerformance: keywordSummary.map((kw) => ({
        keyword: kw.keyword,
        runs: kw._count,
        postsReceived: kw._sum.postsReceived || 0,
        postsProcessed: kw._sum.postsProcessed || 0,
        opportunitiesCreated: kw._sum.opportunitiesCreated || 0,
        conversionRate:
          kw._sum.postsReceived && kw._sum.postsReceived > 0
            ? (((kw._sum.opportunitiesCreated || 0) / kw._sum.postsReceived) * 100).toFixed(1)
            : '0.0',
      })),
    });
  } catch (error) {
    console.error('[KeywordStats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch keyword stats', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/keyword-stats
 * Mark a keyword run as completed or failed
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runId, status } = body;

    if (!runId || !status) {
      return NextResponse.json(
        { error: 'Missing runId or status' },
        { status: 400 }
      );
    }

    const updated = await prisma.keywordRun.update({
      where: { id: runId },
      data: {
        status: status as 'STARTED' | 'COMPLETED' | 'FAILED',
        completedAt: status !== 'STARTED' ? new Date() : null,
      },
    });

    return NextResponse.json({
      success: true,
      run: updated,
    });
  } catch (error) {
    console.error('[KeywordStats] Error updating run:', error);
    return NextResponse.json(
      { error: 'Failed to update keyword run', details: String(error) },
      { status: 500 }
    );
  }
}
