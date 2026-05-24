import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { processDataSource } from '@/services/sources';
import { checkAdminSession } from '@/lib/admin-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/admin/sources/[id]/run - Run a specific source
export async function POST(request: NextRequest, context: RouteContext) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;
  try {
    const { id } = await context.params;

    // Check if source exists and is active before processing
    const source = await prisma.dataSource.findUnique({
      where: { id },
      select: { id: true, name: true, isActive: true },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    if (!source.isActive) {
      return NextResponse.json(
        { error: `Source "${source.name}" is not active. Enable it first.` },
        { status: 400 }
      );
    }

    const stats = await processDataSource(id);

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Failed to run source:', error);
    return NextResponse.json(
      { error: 'Failed to run source', details: String(error) },
      { status: 500 }
    );
  }
}
