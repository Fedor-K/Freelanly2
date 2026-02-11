import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * GET /api/social/posted-urns
 * Returns recent LinkedIn post URNs for comment monitoring workflow.
 * Query params:
 *   days — how far back to look (default 5)
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const days = parseInt(request.nextUrl.searchParams.get('days') || '5', 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const posts = await prisma.socialPostQueue.findMany({
    where: {
      status: 'POSTED',
      linkedinPostUrn: { not: null },
      postedAt: { gte: since },
    },
    select: {
      linkedinPostUrn: true,
      postText: true,
      postedAt: true,
    },
    orderBy: { postedAt: 'desc' },
  });

  return NextResponse.json({
    success: true,
    count: posts.length,
    posts,
  });
}
