import { NextRequest, NextResponse } from 'next/server';
import { addTagToSource, removeTagFromSource } from '@/services/source-scoring';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/admin/sources/[id]/tags - Add tag to source
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { tag } = await request.json();

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag is required' },
        { status: 400 }
      );
    }

    await addTagToSource(id, tag);

    return NextResponse.json({
      success: true,
      message: `Added tag "${tag}"`,
    });
  } catch (error) {
    console.error('Failed to add tag:', error);
    return NextResponse.json(
      { error: 'Failed to add tag', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/sources/[id]/tags - Remove tag from source
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');

    if (!tag) {
      return NextResponse.json(
        { error: 'Tag is required' },
        { status: 400 }
      );
    }

    await removeTagFromSource(id, tag);

    return NextResponse.json({
      success: true,
      message: `Removed tag "${tag}"`,
    });
  } catch (error) {
    console.error('Failed to remove tag:', error);
    return NextResponse.json(
      { error: 'Failed to remove tag', details: String(error) },
      { status: 500 }
    );
  }
}
