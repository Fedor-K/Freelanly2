import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AutoApplyStatus } from '@prisma/client';

// 1x1 transparent GIF
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * Tracking pixel endpoint for auto-apply email opens.
 * GET /api/track/auto-apply-open?id=APPLICATION_ID
 *
 * Returns a 1x1 transparent GIF and updates the application status to OPENED
 * (only if currently SENT or DELIVERED).
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');

  if (id) {
    try {
      // Only update if currently SENT or DELIVERED (don't downgrade REPLIED/INTERVIEW)
      const app = await prisma.autoApplication.findUnique({
        where: { id },
        select: { status: true },
      });

      if (
        app &&
        (app.status === AutoApplyStatus.SENT || app.status === AutoApplyStatus.DELIVERED)
      ) {
        await prisma.autoApplication.update({
          where: { id },
          data: { status: AutoApplyStatus.OPENED },
        });
        console.log(`[Track] Auto-apply email opened: ${id}`);
      }
    } catch (error) {
      // Silently fail — tracking should never break email rendering
      console.error(`[Track] Error tracking auto-apply open for ${id}:`, error);
    }
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}
