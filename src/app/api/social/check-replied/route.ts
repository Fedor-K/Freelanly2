import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * POST /api/social/check-replied
 * Check if we already replied to a LinkedIn comment.
 * Body: { commentId: string }
 */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { commentId } = await request.json();

  if (!commentId) {
    return NextResponse.json({ error: 'commentId required' }, { status: 400 });
  }

  const existing = await prisma.linkedInCommentReply.findUnique({
    where: { commentId },
  });

  return NextResponse.json({ replied: !!existing });
}
