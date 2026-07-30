import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { abBucket } from '@/lib/ab';

/**
 * GET /api/user/queue-count — the size of the user's ready match-queue + their wall A/B bucket.
 * Lets ApplyPaywallModal show the "N applications matched to your profile" offer on EVERY surface
 * (project page, sidebar top-up), not just the discovery feed which threads these as props. Same
 * definition the dashboard uses (REVIEW rows in the last 48h) so the number is consistent.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ count: 0, variant: 'A' });
  const since = new Date(Date.now() - 48 * 3600 * 1000);
  const count = await prisma.autoApplication.count({
    where: { userId: session.user.id, status: 'REVIEW', createdAt: { gte: since } },
  }).catch(() => 0);
  return NextResponse.json({ count, variant: abBucket(session.user.id, 'wall_queue_offer_v1') });
}
