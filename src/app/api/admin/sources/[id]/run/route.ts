import { NextRequest, NextResponse } from 'next/server';
import { processDataSource } from '@/services/sources';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/admin/sources/[id]/run - Run a specific source
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

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
