import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/admin/sources/[id] - Get a single source
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const source = await prisma.dataSource.findUnique({
      where: { id },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    // Get recent import logs
    const recentLogs = await prisma.importLog.findMany({
      where: { source: source.sourceType },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      source,
      recentLogs,
    });
  } catch (error) {
    console.error('Failed to fetch source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch source', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/sources/[id] - Update a source
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const { name, isActive, apiUrl, config, minInterval } = body;

    const source = await prisma.dataSource.findUnique({
      where: { id },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    const updated = await prisma.dataSource.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(isActive !== undefined && { isActive }),
        ...(apiUrl !== undefined && { apiUrl }),
        ...(config !== undefined && { config }),
        ...(minInterval !== undefined && { minInterval }),
      },
    });

    return NextResponse.json({
      success: true,
      source: updated,
    });
  } catch (error) {
    console.error('Failed to update source:', error);
    return NextResponse.json(
      { error: 'Failed to update source', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sources/[id] - Delete a source
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const source = await prisma.dataSource.findUnique({
      where: { id },
    });

    if (!source) {
      return NextResponse.json(
        { error: 'Source not found' },
        { status: 404 }
      );
    }

    await prisma.dataSource.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted source: ${source.name}`,
    });
  } catch (error) {
    console.error('Failed to delete source:', error);
    return NextResponse.json(
      { error: 'Failed to delete source', details: String(error) },
      { status: 500 }
    );
  }
}
