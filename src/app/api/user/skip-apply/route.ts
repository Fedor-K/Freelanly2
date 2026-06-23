import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/user/skip-apply
 * Mark a project as skipped — won't auto-apply.
 * Body: { opportunityId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { opportunityId } = await request.json();
    if (!opportunityId) {
      return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
    }

    // Check if already exists
    const existing = await prisma.autoApplication.findFirst({
      where: { userId: session.user.id, opportunityId },
    });

    if (existing) {
      // Update to SKIPPED if pending
      if (existing.status === 'PENDING' || existing.status === 'REVIEW') {
        await prisma.autoApplication.update({
          where: { id: existing.id },
          data: { status: 'SKIPPED' },
        });
      }
      return NextResponse.json({ success: true, skipped: true });
    }

    // Create SKIPPED record to prevent future auto-apply
    let loop = await prisma.autoApplyLoop.findFirst({
      where: { userId: session.user.id },
    });

    if (!loop) {
      return NextResponse.json({ success: true, skipped: true });
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { title: true, clientName: true, applyEmail: true },
    });

    if (!opportunity) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.autoApplication.create({
      data: {
        origin: 'SELF', // user-initiated skip
        userId: session.user.id,
        loopId: loop.id,
        opportunityId,
        companyName: opportunity.clientName,
        jobTitle: opportunity.title,
        appliedToEmail: opportunity.applyEmail || '',
        coverLetter: '',
        subject: '',
        status: 'SKIPPED',
      },
    });

    return NextResponse.json({ success: true, skipped: true });
  } catch (error) {
    console.error('[SkipApply] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
