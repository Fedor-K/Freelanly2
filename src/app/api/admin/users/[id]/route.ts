import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { plan } = body;

    if (!plan || !['FREE', 'PRO', 'ENTERPRISE'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan. Must be FREE, PRO, or ENTERPRISE' },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: { plan },
      select: {
        id: true,
        email: true,
        name: true,
        plan: true,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Delete related data first (cascade doesn't always work)
    await prisma.$transaction([
      prisma.alertNotification.deleteMany({ where: { jobAlert: { userId: id } } }),
      prisma.alertLanguagePair.deleteMany({ where: { jobAlert: { userId: id } } }),
      prisma.jobAlert.deleteMany({ where: { userId: id } }),
      prisma.savedJob.deleteMany({ where: { userId: id } }),
      prisma.application.deleteMany({ where: { userId: id } }),
      prisma.applyAttempt.deleteMany({ where: { userId: id } }),
      prisma.session.deleteMany({ where: { userId: id } }),
      prisma.account.deleteMany({ where: { userId: id } }),
      prisma.user.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Failed to delete user', details: String(error) },
      { status: 500 }
    );
  }
}
