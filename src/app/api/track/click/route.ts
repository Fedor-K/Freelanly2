import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

/**
 * GET /api/track/click?url=encodedUrl&aid=alertId&uid=userId&type=job|opportunity
 *
 * Tracks link clicks from alert emails, then redirects to the actual URL.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');
  const alertId = searchParams.get('aid');
  const userId = searchParams.get('uid');
  const type = searchParams.get('type'); // job or opportunity

  if (!targetUrl) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Log the click event (non-blocking)
  if (alertId || userId) {
    prisma.activityLog.create({
      data: {
        userId: userId || null,
        action: ActivityAction.ALERT_EMAIL_CLICK,
        details: { alertId, url: targetUrl, type },
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: request.headers.get('user-agent') || null,
        country: request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || null,
      },
    }).catch((e) => console.error('[Track/Click] Error:', e));
  }

  // Redirect to the actual URL
  return NextResponse.redirect(targetUrl);
}
