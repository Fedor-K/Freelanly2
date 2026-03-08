/**
 * One-time setup: Create Google Ads WEBPAGE conversion actions.
 * DELETE THIS FILE after use.
 *
 * GET /api/setup-conversions?key=fr33lanly-setup-2026
 */
import { NextRequest, NextResponse } from 'next/server';
import { createConversionAction, listConversions } from '@/lib/google-ads';

const SETUP_KEY = 'fr33lanly-setup-2026';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== SETUP_KEY) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 });
  }

  try {
    // Create 4 WEBPAGE conversion actions
    const conversions = [
      { name: 'Website - Signup', category: 'SIGNUP' as const, type: 'WEBPAGE' as const },
      { name: 'Website - Purchase', category: 'PURCHASE' as const, type: 'WEBPAGE' as const },
      { name: 'Website - Apply Click', category: 'DEFAULT' as const, type: 'WEBPAGE' as const },
      { name: 'Website - Alert Subscribe', category: 'SUBSCRIBE_PAID' as const, type: 'WEBPAGE' as const },
    ];

    const results = [];
    for (const conv of conversions) {
      try {
        const resourceName = await createConversionAction(conv.name, conv.category, conv.type);
        results.push({ ...conv, resourceName, status: 'created' });
      } catch (error) {
        results.push({ ...conv, error: String(error), status: 'failed' });
      }
    }

    // List all conversions to verify
    const allConversions = await listConversions();

    return NextResponse.json({ results, allConversions });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
