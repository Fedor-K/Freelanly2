import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

/**
 * Tracking pixel for "recruiter replied" notification email opens.
 * GET /api/track/reply-open?app=APPLICATION_ID&u=USER_ID
 *
 * Returns a 1x1 transparent GIF and logs a REPLY_EMAIL_OPEN event.
 * Measures: did the user even SEE the reply notification (vs. it landing in spam)?
 */

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('app');
  const userId = searchParams.get('u');

  if (appId || userId) {
    prisma.activityLog
      .create({
        data: {
          userId: userId || null,
          action: ActivityAction.REPLY_EMAIL_OPEN,
          details: { applicationId: appId },
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          userAgent: request.headers.get('user-agent') || null,
          country:
            request.headers.get('x-vercel-ip-country') ||
            request.headers.get('cf-ipcountry') ||
            null,
        },
      })
      .catch((e) => console.error('[Track/ReplyOpen] Error:', e));
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
