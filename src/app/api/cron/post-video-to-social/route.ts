import { NextRequest, NextResponse } from 'next/server';
import {
  getNextVideoPost,
  markVideoAsPosted,
  markVideoAsFailed,
  getVideoQueueStats,
  refillVideoQueue,
  cleanupOldVideoItems,
} from '@/services/video-post';

/**
 * Cron endpoint for posting VIDEO jobs to social media
 * Called every 30 minutes by n8n
 * Returns video script data for n8n to generate and post
 *
 * POST /api/cron/post-video-to-social
 * Authorization: Bearer $CRON_SECRET
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Starting video post job...');

  try {
    // Cleanup old posted items (> 7 days) to allow re-posting
    const cleanedUp = await cleanupOldVideoItems(7);
    if (cleanedUp > 0) {
      console.log(`[Cron] Cleaned up ${cleanedUp} old video items`);
    }

    // Auto-refill queue if running low (< 5 pending)
    const refillResult = await refillVideoQueue({
      minQueueSize: 5,
      refillCount: 20,
      maxAgeDays: 7,
    });

    if (refillResult.added > 0) {
      console.log(`[Cron] Refilled video queue with ${refillResult.added} jobs`);
    }

    // Get queue stats
    const stats = await getVideoQueueStats();
    console.log(`[Cron] Video queue stats: ${stats.pending} pending, ${stats.posted} posted, ${stats.failed} failed`);

    if (stats.pending === 0) {
      return NextResponse.json({
        success: true,
        hasPost: false,
        message: 'Video queue is empty',
        stats,
        body: null,
      });
    }

    // Get next video post data
    const postData = await getNextVideoPost();

    if (!postData) {
      return NextResponse.json({
        success: true,
        hasPost: false,
        message: 'No video post available',
        stats,
        body: null,
      });
    }

    console.log(`[Cron] Returning video post for job: ${postData.jobId}`);

    // Return data for n8n to create video and post
    return NextResponse.json({
      success: true,
      hasPost: true,
      stats,
      body: {
        queueItemId: postData.queueItemId,
        jobId: postData.jobId,
        scenes: postData.scenes,
        config: postData.config,
        jobUrl: postData.jobUrl,
        socialCaption: postData.socialCaption,
      },
    });
  } catch (error) {
    console.error('[Cron] Video post error:', error);
    return NextResponse.json(
      { error: 'Failed to process video post', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Mark video post as completed or failed (called by n8n after posting)
 */
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { queueItemId, status, error, videoId, videoUrl } = await request.json();

    if (!queueItemId) {
      return NextResponse.json({ error: 'queueItemId required' }, { status: 400 });
    }

    if (status === 'posted') {
      await markVideoAsPosted(queueItemId, videoId, videoUrl);
      return NextResponse.json({ success: true, message: 'Marked as posted' });
    } else if (status === 'failed') {
      await markVideoAsFailed(queueItemId, error || 'Unknown error');
      return NextResponse.json({ success: true, message: 'Marked as failed' });
    }

    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/**
 * GET - Check video queue status
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getVideoQueueStats();
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get stats', details: String(error) },
      { status: 500 }
    );
  }
}
