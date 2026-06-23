import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * POST /api/user/actions
 * Handles various user actions:
 * - save_for_later: bookmark an opportunity
 * - move_to_pipeline: change application status manually
 * - snooze: snooze a reply for X days
 * - duplicate_template: copy a template
 * - delete_account: delete user and all data
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, ...data } = await request.json();
    const userId = session.user.id;

    // === Save for later (bookmark) ===
    if (action === 'save_for_later') {
      const { opportunityId } = data;
      if (!opportunityId) return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });

      // Use REVIEW status as "saved"
      const existing = await prisma.autoApplication.findFirst({
        where: { userId, opportunityId },
      });

      if (existing) {
        await prisma.autoApplication.update({
          where: { id: existing.id },
          data: { status: 'REVIEW' },
        });
      } else {
        let loop = await prisma.autoApplyLoop.findFirst({ where: { userId } });
        if (!loop) return NextResponse.json({ error: 'No loop' }, { status: 400 });

        const opp = await prisma.opportunity.findUnique({
          where: { id: opportunityId },
          select: { title: true, clientName: true, applyEmail: true },
        });
        if (!opp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        await prisma.autoApplication.create({
          data: {
            origin: 'SELF', // user-initiated action (save to review)
            userId, loopId: loop.id, opportunityId,
            companyName: opp.clientName, jobTitle: opp.title,
            appliedToEmail: opp.applyEmail || '', coverLetter: '', subject: '',
            status: 'REVIEW',
          },
        });
      }
      return NextResponse.json({ success: true });
    }

    // === Move to pipeline (change status) ===
    if (action === 'move_to_pipeline') {
      const { applicationId, status } = data;
      if (!applicationId || !status) return NextResponse.json({ error: 'applicationId and status required' }, { status: 400 });

      const valid = ['SENT', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'];
      if (!valid.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 });

      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: { status },
      });
      return NextResponse.json({ success: true });
    }

    // === Snooze ===
    if (action === 'snooze') {
      const { applicationId, days } = data;
      if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

      const snoozeUntil = new Date(Date.now() + (days || 3) * 24 * 60 * 60 * 1000);
      await prisma.autoApplication.update({
        where: { id: applicationId },
        data: { errorMessage: `[snoozed] until ${snoozeUntil.toISOString().slice(0, 10)}` },
      });
      return NextResponse.json({ success: true, snoozeUntil });
    }

    // === Duplicate template ===
    if (action === 'duplicate_template') {
      const { templateId } = data;
      if (!templateId) return NextResponse.json({ error: 'templateId required' }, { status: 400 });

      const original = await prisma.coverLetterTemplate.findFirst({
        where: { id: templateId, userId },
      });
      if (!original) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const copy = await prisma.coverLetterTemplate.create({
        data: {
          userId,
          name: `${original.name} (copy)`,
          subject: original.subject,
          body: original.body,
          type: original.type,
          isDefault: false,
        },
      });
      return NextResponse.json({ success: true, template: copy });
    }

    // === Delete account ===
    if (action === 'delete_account') {
      const { confirm } = data;
      if (confirm !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm' }, { status: 400 });

      await prisma.user.delete({ where: { id: userId } });
      return NextResponse.json({ success: true, deleted: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[Actions] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
