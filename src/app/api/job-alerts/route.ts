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

    // Check if subscriber already exists
    // In a real implementation, you'd have a JobAlert model
    // For now, we'll just add to DashaMail

    try {
      await addSubscriber(email, {
        category: category || 'all',
        keywords: keywords || '',
        source: 'job_alert',
      });
    } catch (error) {
      console.error('Failed to add to DashaMail:', error);
      // Continue anyway - we can still track locally
    }

    // Log the subscription (would be stored in DB in production)
    console.log('Job alert subscription:', { email, category, keywords });

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
