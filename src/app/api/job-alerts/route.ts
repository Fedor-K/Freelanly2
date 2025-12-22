import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { addSubscriber } from '@/lib/dashamail';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, category, keywords } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

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
        },
      });
    }

    // Also add to DashaMail for email delivery
    try {
      await addSubscriber(email, {
        category: category || 'all',
        keywords: keywords || '',
        source: 'job_alert',
      });
    } catch (error) {
      console.error('Failed to add to DashaMail:', error);
      // Continue anyway - we have it in our database
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
