import { NextResponse } from 'next/server';

/**
 * Start parsing - triggers fetch-sources internally
 * POST /api/admin/start-parsing
 */
export async function POST() {
  const cronSecret = process.env.CRON_SECRET;
  const baseUrl = process.env.AUTH_URL || 'https://freelanly.com';

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${baseUrl}/api/cron/fetch-sources`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${cronSecret}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Failed: ${res.status}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Parsing started' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
