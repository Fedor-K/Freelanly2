import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// GET /api/user/alerts - Get user's job alerts
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await prisma.jobAlert.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('[API] Error getting alerts:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/user/alerts - Create a new job alert
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { category, keywords, country, level, frequency } = body;

    // Validate frequency
    const validFrequencies = ['INSTANT', 'DAILY', 'WEEKLY'];
    if (frequency && !validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: 'Invalid frequency' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const alert = await prisma.jobAlert.create({
      data: {
        userId: session.user.id,
        email: user.email,
        category: category || null,
        keywords: keywords?.trim() || null,
        country: country || null,
        level: level || null,
        frequency: frequency || 'DAILY',
        isActive: true,
      },
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('[API] Error creating alert:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
