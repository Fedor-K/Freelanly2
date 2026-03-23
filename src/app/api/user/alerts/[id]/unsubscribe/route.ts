import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/user/alerts/[id]/unsubscribe
 *
 * Unsubscribe from a specific alert via link in email.
 * Deactivates the alert and redirects to confirmation page.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: alertId } = await context.params;

    if (!alertId) {
      return NextResponse.redirect(new URL('/unsubscribe?error=missing_id', request.url));
    }

    // Find the alert
    const alert = await prisma.jobAlert.findUnique({
      where: { id: alertId },
      select: { id: true, userId: true, email: true, isActive: true },
    });

    if (!alert) {
      return NextResponse.redirect(new URL('/unsubscribe?error=not_found', request.url));
    }

    // Deactivate the alert
    await prisma.jobAlert.update({
      where: { id: alertId },
      data: { isActive: false },
    });

    // Log the unsubscribe
    if (alert.userId) {
      await prisma.activityLog.create({
        data: {
          userId: alert.userId,
          action: ActivityAction.UNSUBSCRIBE,
          details: {
            alertId,
            email: alert.email,
            source: 'email_link',
          },
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
          country: request.headers.get('x-vercel-ip-country') || null,
        },
      }).catch(() => {});
    }

    console.log(`[Unsubscribe] Alert ${alertId} deactivated (email: ${alert.email || 'unknown'})`);

    // Redirect to success page
    return NextResponse.redirect(new URL('/unsubscribe?success=true&type=alert', request.url));
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    return NextResponse.redirect(new URL('/unsubscribe?error=failed', request.url));
  }
}
