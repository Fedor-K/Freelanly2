import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    const results = await prisma.autoApplication.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { jobTitle: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { appliedToEmail: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        jobTitle: true,
        companyName: true,
        status: true,
        repliedAt: true,
      },
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[Search] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
