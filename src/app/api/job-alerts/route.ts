import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimitByDb, getClientIp, sanitizeEmail } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);

    // DB-backed rate limit: 3 alert creations per hour per IP
    // Uses ActivityLog so it works across Vercel instances
    const ipLimit = await rateLimitByDb('ALERT_CREATED', ip, 3, 3600_000);
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email, category, keywords } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Sanitize email — prevent header injection
    const cleanEmail = sanitizeEmail(email);

    // Translation category requires registration with language selection
    if (category === 'translation') {
      return NextResponse.json(
        { error: 'Translation alerts require language selection. Please register to set up translation alerts.' },
        { status: 400 }
      );
    }

    // All alerts are INSTANT now
    const alertFrequency = 'INSTANT';

    // Check if subscriber already exists with same email and filters
    const existing = await prisma.jobAlert.findFirst({
      where: {
        email: cleanEmail,
        category: category || null,
        keywords: keywords || null,
      },
    });

    if (existing) {
      // Reactivate if was inactive
      if (!existing.isActive) {
        await prisma.jobAlert.update({
          where: { id: existing.id },
          data: { isActive: true },
        });
      }
    } else {
      // Create new subscription
      await prisma.jobAlert.create({
        data: {
          email: cleanEmail,
          category: category || null,
          keywords: keywords || null,
          frequency: alertFrequency,
        },
      });
    }

    // Log for DB-backed rate limiting
    prisma.activityLog.create({
      data: {
        action: 'ALERT_CREATED',
        ipAddress: ip,
        details: { email: cleanEmail, category: category || null },
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to job alerts',
    });
  } catch (error) {
    console.error('Job alert error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe' },
      { status: 500 }
    );
  }
}
