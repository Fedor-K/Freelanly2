import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// POST /api/jobs/[id]/save - Save a job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId } = await params;

    // Check if job exists
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Check if already saved
    const existing = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: session.user.id,
          jobId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ saved: true, message: 'Already saved' });
    }

    // Save the job
    await prisma.savedJob.create({
      data: {
        userId: session.user.id,
        jobId,
      },
    });

    return NextResponse.json({ saved: true, message: 'Job saved' });
  } catch (error) {
    console.error('[API] Error saving job:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// DELETE /api/jobs/[id]/save - Unsave a job
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: jobId } = await params;

    await prisma.savedJob.deleteMany({
      where: {
        userId: session.user.id,
        jobId,
      },
    });

    return NextResponse.json({ saved: false, message: 'Job unsaved' });
  } catch (error) {
    console.error('[API] Error unsaving job:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET /api/jobs/[id]/save - Check if job is saved
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ saved: false });
    }

    const { id: jobId } = await params;

    const saved = await prisma.savedJob.findUnique({
      where: {
        userId_jobId: {
          userId: session.user.id,
          jobId,
        },
      },
    });

    return NextResponse.json({ saved: !!saved });
  } catch (error) {
    console.error('[API] Error checking saved job:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
