import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/admin/parsing - Get parsing stats for last 20 days
// Optional: ?dataSourceId=xxx to filter by specific source
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dataSourceId = searchParams.get('dataSourceId');

    const twentyDaysAgo = new Date();
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

    // Get all import logs for last 20 days with related data
    const importLogs = await prisma.importLog.findMany({
      where: {
        startedAt: { gte: twentyDaysAgo },
        ...(dataSourceId ? { dataSourceId } : {}),
      },
      include: {
        dataSource: {
          select: {
            id: true,
            name: true,
            companySlug: true,
            sourceType: true,
          },
        },
        filteredJobs: {
          select: {
            id: true,
            title: true,
            company: true,
            location: true,
            reason: true,
            createdAt: true,
          },
        },
        importedJobs: {
          select: {
            id: true,
            job: {
              select: {
                id: true,
                title: true,
                slug: true,
                company: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        startedAt: 'desc',
      },
    });

    // Group by source + company (dataSourceId)
    const groupedData = new Map<
      string,
      {
        sourceType: string;
        companyName: string | null;
        companySlug: string | null;
        dataSourceId: string | null;
        totalRuns: number;
        lastRunAt: Date | null;
        totalAdded: number;
        totalFiltered: number;
        runs: Array<{
          id: string;
          startedAt: Date;
          completedAt: Date | null;
          status: string;
          totalFetched: number;
          totalNew: number;
          totalSkipped: number;
          addedJobs: Array<{
            id: string;
            title: string;
            slug: string;
            companyName: string;
            companySlug: string;
          }>;
          filteredJobs: Array<{
            id: string;
            title: string;
            company: string;
            location: string | null;
            reason: string;
          }>;
        }>;
      }
    >();

    for (const log of importLogs) {
      // Create unique key: source + company (or just source for aggregators)
      const key = log.dataSourceId || `${log.source}_aggregator`;

      if (!groupedData.has(key)) {
        groupedData.set(key, {
          sourceType: log.source,
          companyName: log.dataSource?.name || null,
          companySlug: log.dataSource?.companySlug || null,
          dataSourceId: log.dataSourceId,
          totalRuns: 0,
          lastRunAt: null,
          totalAdded: 0,
          totalFiltered: 0,
          runs: [],
        });
      }

      const group = groupedData.get(key)!;
      group.totalRuns++;

      if (!group.lastRunAt || log.startedAt > group.lastRunAt) {
        group.lastRunAt = log.startedAt;
      }

      const addedJobs = log.importedJobs.map((ij) => ({
        id: ij.job.id,
        title: ij.job.title,
        slug: ij.job.slug,
        companyName: ij.job.company.name,
        companySlug: ij.job.company.slug,
      }));

      const filteredJobs = log.filteredJobs.map((fj) => ({
        id: fj.id,
        title: fj.title,
        company: fj.company,
        location: fj.location,
        reason: fj.reason,
      }));

      group.totalAdded += addedJobs.length;
      group.totalFiltered += filteredJobs.length;

      group.runs.push({
        id: log.id,
        startedAt: log.startedAt,
        completedAt: log.completedAt,
        status: log.status,
        totalFetched: log.totalFetched,
        totalNew: log.totalNew,
        totalSkipped: log.totalSkipped,
        addedJobs,
        filteredJobs,
      });
    }

    // Convert to array and sort by last run time
    const result = Array.from(groupedData.values())
      .sort((a, b) => {
        if (!a.lastRunAt) return 1;
        if (!b.lastRunAt) return -1;
        return b.lastRunAt.getTime() - a.lastRunAt.getTime();
      })
      .map((group) => ({
        ...group,
        // Limit runs to last 10 for initial load (can paginate later)
        runs: group.runs.slice(0, 10),
      }));

    return NextResponse.json({
      success: true,
      data: result,
      period: {
        from: twentyDaysAgo.toISOString(),
        to: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching parsing stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch parsing stats' },
      { status: 500 }
    );
  }
}
