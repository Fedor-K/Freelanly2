import { NextRequest, NextResponse } from 'next/server';
import { fetchAndProcessLinkedInPosts } from '@/services/linkedin-processor';

// Cron job endpoint for fetching LinkedIn posts
// Call this via cron: curl -X POST http://localhost:3000/api/cron/fetch-linkedin -H "Authorization: Bearer YOUR_CRON_SECRET"

export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const stats = await fetchAndProcessLinkedInPosts({
      keywords: body.keywords || ['hiring remote', 'we are hiring', 'join our team remote', 'looking for developer'],
      maxPosts: body.maxPosts || 50,
    });

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

// Also allow GET for easy testing
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await fetchAndProcessLinkedInPosts({
      keywords: ['hiring remote developer'],
      maxPosts: 10, // Small batch for testing
    });

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
