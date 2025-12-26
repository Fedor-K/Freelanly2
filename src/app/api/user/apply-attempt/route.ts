import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendNurtureEmailForAttempt } from '@/services/nurture-emails';

// POST - Track when a FREE user tries to apply and send nurture email
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      // Still track anonymous attempts by returning silently
      return NextResponse.json({ ok: true });
    }

    const { jobId } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }

    // Check if user is already PRO (shouldn't happen but just in case)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true, email: true, name: true },
    });

    if (user?.plan !== 'FREE') {
      return NextResponse.json({ ok: true, isPro: true });
    }

    // Check if we already tracked this attempt recently (within 24h)
    const recentAttempt = await prisma.applyAttempt.findFirst({
      where: {
        userId: session.user.id,
        jobId,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recentAttempt) {
      // Already tracked, don't create duplicate or send email again
      return NextResponse.json({ ok: true, existing: true });
    }

    // Create new apply attempt
    const attempt = await prisma.applyAttempt.create({
      data: {
        userId: session.user.id,
        jobId,
      },
    });

    // Send nurture email immediately (non-blocking)
    sendNurtureEmailForAttempt(attempt.id).catch((err) => {
      console.error('[ApplyAttempt] Nurture email failed:', err);
    });

    return NextResponse.json({ ok: true, tracked: true });
  } catch (error) {
    console.error('[ApplyAttempt] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// GET - Get user's recent apply attempts (for showing in dashboard)
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const attempts = await prisma.applyAttempt.findMany({
      where: { userId: session.user.id },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            slug: true,
            company: {
              select: { name: true, slug: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({ attempts });
  } catch (error) {
    console.error('[ApplyAttempt] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
