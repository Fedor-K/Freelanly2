import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

const SITE = 'https://freelanly.com';
const DEFAULT_DEST = '/dashboard?tab=inbox';

/**
 * Tracked click-through for "recruiter replied" notification emails.
 * GET /api/track/reply-click?app=APPLICATION_ID&u=USER_ID&to=/dashboard?tab=inbox
 *
 * Logs a REPLY_EMAIL_CLICK event, then redirects to the dashboard.
 * Measures: did the user actually CARE enough to click through?
 *
 * Open-redirect safe: only relative paths ("/...") are honored; anything
 * else falls back to the dashboard inbox.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('app');
  const userId = searchParams.get('u');
  const toParam = searchParams.get('to');

  // Only allow same-site relative paths (block open redirects)
  const dest = toParam && /^\/[^/]/.test(toParam) ? toParam : DEFAULT_DEST;

  if (appId || userId) {
    prisma.activityLog
      .create({
        data: {
          userId: userId || null,
          action: ActivityAction.REPLY_EMAIL_CLICK,
          details: { applicationId: appId, to: dest },
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          userAgent: request.headers.get('user-agent') || null,
          country:
            request.headers.get('x-vercel-ip-country') ||
            request.headers.get('cf-ipcountry') ||
            null,
        },
      })
      .catch((e) => console.error('[Track/ReplyClick] Error:', e));
  }

  return NextResponse.redirect(`${SITE}${dest}`);
}
