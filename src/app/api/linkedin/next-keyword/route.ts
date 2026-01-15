/**
 * LinkedIn Freelance Keyword Rotator API
 *
 * Returns a random keyword for LinkedIn search.
 * Called by n8n every 10-15 minutes to get the next keyword.
 *
 * GET /api/linkedin/next-keyword
 * Response: { keyword, index, total, runId }
 *
 * Creates a KeywordRun record for tracking which keywords were used
 * and how many posts/opportunities they generated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  getKeywordInfo,
  getAllKeywords,
  TOTAL_KEYWORDS,
} from '@/config/freelance-discovery';

export async function GET(request: NextRequest) {
  try {
    const info = getKeywordInfo();

    // Check if we should create a KeywordRun (only if called by n8n with tracking param)
    // Or always create for proper tracking
    const createRun = request.nextUrl.searchParams.get('track') !== 'false';

    let runId: string | null = null;

    if (createRun) {
      // Check if there's already a run for this keyword in the last 10 minutes
      // to avoid creating duplicate runs if endpoint is called multiple times
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

      const existingRun = await prisma.keywordRun.findFirst({
        where: {
          keyword: info.keyword,
          keywordIndex: info.index,
          startedAt: { gte: tenMinutesAgo },
        },
        orderBy: { startedAt: 'desc' },
      });

      if (existingRun) {
        runId = existingRun.id;
      } else {
        // Create new KeywordRun
        const newRun = await prisma.keywordRun.create({
          data: {
            keyword: info.keyword,
            keywordIndex: info.index,
            status: 'STARTED',
          },
        });
        runId = newRun.id;
        console.log(`[NextKeyword] Created KeywordRun ${runId} for "${info.keyword}"`);
      }
    }

    return NextResponse.json({
      success: true,
      ...info,
      runId, // Include runId for tracking in webhook
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
