import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, category, keywords, frequency, source: _source } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
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
