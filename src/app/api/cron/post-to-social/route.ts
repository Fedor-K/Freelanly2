import { NextRequest, NextResponse } from 'next/server';
import { processNextSocialPost, getSocialQueueStats } from '@/services/social-post';

/**
 * Cron endpoint for posting jobs to social media
 * Called every 15 minutes via Replit Scheduled Deployments or external cron
 *
 * POST /api/cron/post-to-social
 * Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Starting social post job...');

  try {
    // Get queue stats before processing
    const statsBefore = await getSocialQueueStats();
    console.log(`[Cron] Queue stats: ${statsBefore.pending} pending, ${statsBefore.posted} posted, ${statsBefore.failed} failed`);

    if (statsBefore.pending === 0) {
      return NextResponse.json({
        success: true,
        message: 'Queue is empty, nothing to post',
        stats: statsBefore
      });
    }

    // Process one item from queue
    const result = await processNextSocialPost();

    // Get updated stats
    const statsAfter = await getSocialQueueStats();

    if (result.posted) {
      console.log(`[Cron] Successfully posted job ${result.jobId}`);
      return NextResponse.json({
        success: true,
        message: `Posted job ${result.jobId}`,
        stats: statsAfter
      });
    } else {
      console.log(`[Cron] Failed to post: ${result.error}`);
      return NextResponse.json({
        success: false,
        message: result.error,
        jobId: result.jobId,
        stats: statsAfter
      });
    }
  } catch (error) {
    console.error('[Cron] Social post error:', error);
    return NextResponse.json(
      { error: 'Failed to process social post', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET - Check queue status
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getSocialQueueStats();
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get stats', details: String(error) },
      { status: 500 }
    );
  }
}
