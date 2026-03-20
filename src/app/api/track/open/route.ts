import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

/**
 * GET /api/track/open?aid=alertId&uid=userId
 *
 * 1x1 transparent pixel for email open tracking.
 * Embedded in alert emails as <img src="..."> tag.
 */

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const alertId = searchParams.get('aid');
  const userId = searchParams.get('uid');

  // Log the open event (non-blocking)
  if (alertId || userId) {
    prisma.activityLog.create({
      data: {
        userId: userId || null,
        action: ActivityAction.ALERT_EMAIL_OPEN,
        details: { alertId },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
        country: request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || null,
      },
    }).catch((e) => console.error('[Track/Open] Error:', e));
  }

  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  });
}
