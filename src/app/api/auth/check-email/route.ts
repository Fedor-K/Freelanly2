import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase().trim() },
      select: { id: true, emailVerified: true, resumeUrl: true },
    });

    return NextResponse.json({
      exists: !!user?.emailVerified,
      hasResume: !!user?.resumeUrl,
    });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
