import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 3 per minute per IP, 1 per 10 min per email
    const ip = getClientIp(request.headers);
    const ipLimit = rateLimit('alerts_ip', ip, 3, 60_000);
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter) } }
      );
    }

    const body = await request.json();
    const { email, category, keywords, frequency, source: _source } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Rate limit by email: prevent subscribing someone else's email repeatedly
    const emailLimit = rateLimit('alerts_email', email.toLowerCase().trim(), 1, 600_000);
    if (emailLimit.limited) {
      return NextResponse.json(
        { error: 'Alert already created for this email. Check your inbox.' },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfter) } }
      );
    }

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
        email,
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
          email,
          category: category || null,
          keywords: keywords || null,
          frequency: alertFrequency,
        },
      });
    }

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
