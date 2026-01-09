/**
 * LinkedIn Freelance Keyword Rotator API
 *
 * Returns the current keyword for LinkedIn search based on time rotation.
 * Called by n8n every 10 minutes to get the next keyword.
 *
 * GET /api/linkedin/next-keyword
 * Response: { keyword, index, total, nextChangeIn }
 */

import { NextResponse } from 'next/server';
import {
  getKeywordInfo,
  getAllKeywords,
  TOTAL_KEYWORDS,
} from '@/config/freelance-discovery';

export async function GET() {
  try {
    const info = getKeywordInfo();

    return NextResponse.json({
      success: true,
      ...info,
    });
  } catch (error) {
    console.error('[NextKeyword] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get keyword', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * Get all keywords (for admin/debugging)
 *
 * POST /api/linkedin/next-keyword
 * Response: { keywords: [...], total }
 */
export async function POST() {
  try {
    const keywords = getAllKeywords();

    return NextResponse.json({
      success: true,
      keywords,
      total: TOTAL_KEYWORDS,
    });
  } catch (error) {
    console.error('[NextKeyword] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get keywords', details: String(error) },
      { status: 500 }
    );
  }
}
