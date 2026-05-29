import { NextRequest, NextResponse } from 'next/server';
import { checkAdminSession } from '@/lib/admin-auth';
import { fetchAndProcessLinkedInPosts } from '@/services/linkedin-processor';

// Admin endpoint to run LinkedIn scraper
// Requires an admin session (or CRON_SECRET bearer) — NOT public: triggers paid Apify runs.

export async function POST(request: NextRequest) {
  try {
    const authError = await checkAdminSession(request);
    if (authError) return authError;

    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json(
        { error: 'APIFY_API_TOKEN not configured' },
        { status: 400 }
      );
    }

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
    console.error('LinkedIn scraper error:', error);
    return NextResponse.json(
      { error: 'Failed to run scraper', details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Run with DB settings
export async function GET(request: NextRequest) {
  try {
    const authError = await checkAdminSession(request);
    if (authError) return authError;

    if (!process.env.APIFY_API_TOKEN) {
      return NextResponse.json(
        { error: 'APIFY_API_TOKEN not configured' },
        { status: 400 }
      );
    }

    const stats = await fetchAndProcessLinkedInPosts();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('LinkedIn scraper error:', error);
    return NextResponse.json(
      { error: 'Failed to run scraper', details: String(error) },
      { status: 500 }
    );
  }
}
