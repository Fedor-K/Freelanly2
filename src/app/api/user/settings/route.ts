import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/user/settings - Get user settings
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        resumeUrl: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('[API] Error getting user settings:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// PATCH /api/user/settings - Update user settings
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, resumeUrl } = body;

    // Validate resumeUrl if provided
    if (resumeUrl && resumeUrl.length > 0) {
      try {
        new URL(resumeUrl);
      } catch {
        return NextResponse.json(
          { error: 'Invalid resume URL' },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: name?.trim() || null,
        resumeUrl: resumeUrl?.trim() || null,
      },
      select: {
        name: true,
        email: true,
        resumeUrl: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error('[API] Error updating user settings:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
