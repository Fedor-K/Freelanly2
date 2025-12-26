import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const {
      necessary = true,
      analytics = false,
      marketing = false,
      preferences = false,
      version = 1,
      visitorId,
    } = body;

    // Get IP and User Agent
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check if consent already exists for this user/visitor
    let existingConsent = null;

    if (session?.user?.id) {
      existingConsent = await prisma.cookieConsent.findFirst({
        where: { userId: session.user.id },
        orderBy: { consentedAt: 'desc' },
      });
    } else if (visitorId) {
      existingConsent = await prisma.cookieConsent.findFirst({
        where: { visitorId },
        orderBy: { consentedAt: 'desc' },
      });
    }

    if (existingConsent) {
      // Update existing consent
      await prisma.cookieConsent.update({
        where: { id: existingConsent.id },
        data: {
          necessary,
          analytics,
          marketing,
          preferences,
          version,
          ipAddress,
          userAgent,
          // Link to user if they're now logged in
          userId: session?.user?.id || existingConsent.userId,
        },
      });
    } else {
      // Create new consent
      await prisma.cookieConsent.create({
        data: {
          userId: session?.user?.id || null,
          visitorId: session?.user?.id ? null : visitorId,
          necessary,
          analytics,
          marketing,
          preferences,
          version,
          ipAddress,
          userAgent,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CookieConsent] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save consent' },
      { status: 500 }
    );
  }
}

// GET - Check current consent status
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const visitorId = request.nextUrl.searchParams.get('visitorId');

    let consent = null;

    if (session?.user?.id) {
      consent = await prisma.cookieConsent.findFirst({
        where: { userId: session.user.id },
        orderBy: { consentedAt: 'desc' },
      });
    } else if (visitorId) {
      consent = await prisma.cookieConsent.findFirst({
        where: { visitorId },
        orderBy: { consentedAt: 'desc' },
      });
    }

    if (!consent) {
      return NextResponse.json({ hasConsent: false });
    }

    return NextResponse.json({
      hasConsent: true,
      consent: {
        necessary: consent.necessary,
        analytics: consent.analytics,
        marketing: consent.marketing,
        preferences: consent.preferences,
        version: consent.version,
        consentedAt: consent.consentedAt,
      },
    });
  } catch (error) {
    console.error('[CookieConsent] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get consent' },
      { status: 500 }
    );
  }
}
