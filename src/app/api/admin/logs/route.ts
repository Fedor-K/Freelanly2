import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.importLog.findMany({
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
        include: {
          dataSource: {
            select: {
              name: true,
              companySlug: true,
            },
          },
        },
      }),
      prisma.importLog.count(),
    ]);

    return NextResponse.json({
      success: true,
      logs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching import logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch import logs', details: String(error) },
      { status: 500 }
    );
  }
}
