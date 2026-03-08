/**
 * One-time: Get conversion action tag snippets with labels.
 * DELETE THIS FILE after use.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getCustomer } from '@/lib/google-ads';

const SETUP_KEY = 'fr33lanly-setup-2026';

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key');
  if (key !== SETUP_KEY) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 403 });
  }

  try {
    const customer = getCustomer();

    // Query conversion actions with tag_snippets
    const rows = await customer.query(`
      SELECT
        conversion_action.id,
        conversion_action.name,
        conversion_action.type,
        conversion_action.status,
        conversion_action.tag_snippets
      FROM conversion_action
      WHERE conversion_action.id IN (7526737380, 7526394902, 7526737410, 7526737590)
    `);

    const results = rows.map((row: any) => ({
      id: String(row.conversion_action?.id ?? ''),
      name: row.conversion_action?.name ?? '',
      type: row.conversion_action?.type ?? '',
      status: row.conversion_action?.status ?? '',
      tagSnippets: row.conversion_action?.tag_snippets ?? null,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
