import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

/**
 * One-click "Turn on auto-apply" from the discovery onboarding. Flips all the user's loops to AUTO
 * (so the matcher's strong matches auto-send) and logs AUTO_APPLY_ENABLED with the source, so we can
 * measure what % of fresh signups opt into auto-apply from the feed onboarding.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const source = await request.json().then(b => b?.source).catch(() => null);

  const res = await prisma.autoApplyLoop.updateMany({
    where: { userId: session.user.id, mode: { not: 'AUTO' } },
    data: { mode: 'AUTO' },
  });

  await prisma.activityLog.create({
    data: {
      userId: session.user.id,
      action: 'AUTO_APPLY_ENABLED',
      details: { source: source || 'unknown', loopsEnabled: res.count },
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, loopsEnabled: res.count });
}
