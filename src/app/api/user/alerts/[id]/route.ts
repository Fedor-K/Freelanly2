import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// PATCH /api/user/alerts/[id] - Update a job alert
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Check ownership
    const existing = await prisma.jobAlert.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    const { category, keywords, country, level, frequency, isActive } = body;

    const alert = await prisma.jobAlert.update({
      where: { id },
      data: {
        ...(category !== undefined && { category: category || null }),
        ...(keywords !== undefined && { keywords: keywords?.trim() || null }),
        ...(country !== undefined && { country: country || null }),
        ...(level !== undefined && { level: level || null }),
        ...(frequency !== undefined && { frequency }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('[API] Error updating alert:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/user/alerts/[id] - Delete a job alert
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check ownership
    const existing = await prisma.jobAlert.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    }

    await prisma.jobAlert.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error deleting alert:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
