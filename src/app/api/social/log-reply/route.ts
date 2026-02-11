import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * POST /api/social/log-reply
 * Log that we replied to a LinkedIn comment (prevents double replies).
 * Body: { commentId, postUrn, commentText, aiReply }
 */
export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { commentId, postUrn, commentText, aiReply } = await request.json();

  if (!commentId) {
    return NextResponse.json({ error: 'commentId required' }, { status: 400 });
  }

  await prisma.linkedInCommentReply.upsert({
    where: { commentId },
    create: { commentId, postUrn: postUrn || '', commentText: commentText || '', aiReply: aiReply || '' },
    update: {},
  });

  return NextResponse.json({ success: true });
}
