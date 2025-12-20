import { NextRequest, NextResponse } from 'next/server';
import { fetchAndProcessLinkedInPosts } from '@/services/linkedin-processor';

// Cron job endpoint for fetching LinkedIn posts
// Uses settings from database by default
// Call via cron: curl -X POST http://localhost:3000/api/cron/fetch-linkedin -H "Authorization: Bearer YOUR_CRON_SECRET"

export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Pass overrides only if provided, otherwise uses DB settings
    const options: { keywords?: string[]; maxPosts?: number; postedLimit?: '24h' | 'week' | 'month' } = {};
    if (body.keywords) options.keywords = body.keywords;
    if (body.maxPosts) options.maxPosts = body.maxPosts;
    if (body.postedLimit) options.postedLimit = body.postedLimit;

    const stats = await fetchAndProcessLinkedInPosts(
      Object.keys(options).length > 0 ? options : undefined
    );

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('LinkedIn fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn posts', details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Run with DB settings (for easy testing)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Uses settings from database
    const stats = await fetchAndProcessLinkedInPosts();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('LinkedIn fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch LinkedIn posts', details: String(error) },
      { status: 500 }
    );
  }
}
