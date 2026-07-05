import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkAdminSession } from '@/lib/admin-auth';

// PATCH /api/admin/outreach/[id]  { action: 'sent' | 'skip' | 'draft' }
// Founder-only status toggle for a recruiter-outreach draft (mark sent after emailing manually,
// skip a bad one, or move back to draft). Never sends email — this only tracks status.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authError = await checkAdminSession(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json().catch(() => ({} as { action?: string }));
  const action = (body as { action?: string }).action;

  const status = action === 'sent' ? 'SENT' : action === 'skip' ? 'SKIPPED' : action === 'draft' ? 'DRAFT' : null;
  if (!status) return NextResponse.json({ error: 'bad action' }, { status: 400 });

  try {
    await prisma.outreachDraft.update({
      where: { id },
      data: { status, sentAt: status === 'SENT' ? new Date() : null },
    });
    return NextResponse.json({ success: true, status });
  } catch {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
}
