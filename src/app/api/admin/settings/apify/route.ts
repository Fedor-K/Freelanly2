import { NextRequest, NextResponse } from 'next/server';
import { getApifySettings, saveApifySettings, DEFAULT_APIFY_SETTINGS } from '@/lib/settings';

// Simple admin auth check
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.ADMIN_SECRET;

  // If no admin secret set, allow access (development)
  if (!adminSecret) return true;

  return authHeader === `Bearer ${adminSecret}`;
}

// GET - Fetch current Apify settings
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await getApifySettings();

    return NextResponse.json({
      success: true,
      settings,
      defaults: DEFAULT_APIFY_SETTINGS,
    });
  } catch (error) {
    console.error('Error fetching Apify settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: String(error) },
      { status: 500 }
    );
  }
}

// POST - Update Apify settings
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (body.searchQueries && !Array.isArray(body.searchQueries)) {
      return NextResponse.json(
        { error: 'searchQueries must be an array' },
        { status: 400 }
      );
    }

    if (body.postedLimit && !['24h', 'week', 'month'].includes(body.postedLimit)) {
      return NextResponse.json(
        { error: 'postedLimit must be 24h, week, or month' },
        { status: 400 }
      );
    }

    if (body.sortBy && !['date', 'relevance'].includes(body.sortBy)) {
      return NextResponse.json(
        { error: 'sortBy must be date or relevance' },
        { status: 400 }
      );
    }

    const updated = await saveApifySettings(body);

    return NextResponse.json({
      success: true,
      settings: updated,
    });
  } catch (error) {
    console.error('Error saving Apify settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings', details: String(error) },
      { status: 500 }
    );
  }
}

// PUT - Reset to defaults
export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const updated = await saveApifySettings(DEFAULT_APIFY_SETTINGS);

    return NextResponse.json({
      success: true,
      message: 'Settings reset to defaults',
      settings: updated,
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return NextResponse.json(
      { error: 'Failed to reset settings', details: String(error) },
      { status: 500 }
    );
  }
}
