import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/send-schedule — get timezone & schedule
 * PATCH /api/user/send-schedule — update timezone & send hours
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true, sendStartHour: true, sendEndHour: true },
    });

    return NextResponse.json({
      timezone: user?.timezone || 'UTC',
      sendStartHour: user?.sendStartHour ?? 9,
      sendEndHour: user?.sendEndHour ?? 17,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { timezone, sendStartHour, sendEndHour } = await request.json();

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        timezone: timezone || undefined,
        sendStartHour: typeof sendStartHour === 'number' ? sendStartHour : undefined,
        sendEndHour: typeof sendEndHour === 'number' ? sendEndHour : undefined,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
