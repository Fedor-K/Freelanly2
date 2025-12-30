import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const time = searchParams.get('time') || '24h';
  const source = searchParams.get('source');
  const limit = 500;

  // Calculate date filter
  let dateFilter: Date | undefined;
  switch (time) {
    case '24h':
      dateFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      dateFilter = undefined;
  }

  // Build where clause
  const where: Record<string, unknown> = {};

  if (dateFilter) {
    where.createdAt = { gte: dateFilter };
  }

  if (source && source !== 'all') {
    where.source = source;
  }

  try {
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          company: {
            select: { name: true, slug: true },
          },
          category: {
            select: { name: true, slug: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        slug: job.slug,
        source: job.source,
        createdAt: job.createdAt.toISOString(),
        company: job.company,
        category: job.category,
      })),
      total,
    });
  } catch (error) {
    console.error('Failed to fetch jobs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch jobs' },
      { status: 500 }
    );
  }
}
