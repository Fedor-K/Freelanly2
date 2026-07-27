import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/recovery-status
 * Whether the signed-in user has an unused one-time 50%-off recovery grant (issued by the chat
 * win-back flow). The top-up wall reads this to surface the discounted $1.50 first-pack.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ active: false });

    const grant = await prisma.activityLog.findFirst({
      where: { userId: session.user.id, action: 'PAYWALL_CLOSE', details: { path: ['type'], equals: 'recovery_grant' } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true },
    });
    if (!grant) return NextResponse.json({ active: false });

    const used = await prisma.activityLog.findFirst({
      where: { userId: session.user.id, action: 'PAYWALL_CLOSE', details: { path: ['type'], equals: 'recovery_used' }, createdAt: { gte: grant.createdAt } },
      select: { id: true },
    });
    return NextResponse.json({ active: !used });
  } catch {
    return NextResponse.json({ active: false });
  }
}
