import { NextRequest, NextResponse } from 'next/server';
import { getNextSocialPost, markAsPosted, markAsFailed, getSocialQueueStats, refillSocialQueue, cleanupOldPostedItems } from '@/services/social-post';

/**
 * Cron endpoint for posting jobs to social media
 * Called every 15 minutes by n8n
 * Returns post data for n8n to publish to Telegram/LinkedIn
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
    // Cleanup old posted items (> 7 days) to allow re-posting
    const cleanedUp = await cleanupOldPostedItems(7);
    if (cleanedUp > 0) {
      console.log(`[Cron] Cleaned up ${cleanedUp} old posted items`);
    }

    // Auto-refill queue if running low (< 5 pending)
    const refillResult = await refillSocialQueue({
      minQueueSize: 5,
      refillCount: 20,
      maxAgeDays: 14,
    });

    if (refillResult.added > 0) {
      console.log(`[Cron] Refilled queue with ${refillResult.added} jobs`);
    }

    // Get queue stats
    const stats = await getSocialQueueStats();
    console.log(`[Cron] Queue stats: ${stats.pending} pending, ${stats.posted} posted, ${stats.failed} failed`);

    if (stats.pending === 0) {
      // Return empty body - n8n should check this and skip posting
      return NextResponse.json({
        success: true,
        hasPost: false,
        message: 'Queue is empty',
        stats,
        body: null,
      });
    }

    // Get next post data (generates AI content if needed)
    const postData = await getNextSocialPost();

    if (!postData) {
      return NextResponse.json({
        success: true,
        hasPost: false,
        message: 'No post available',
        stats,
        body: null,
      });
    }

    console.log(`[Cron] Returning post for job: ${postData.jobTitle}`);

    // Return data for n8n to post
    return NextResponse.json({
      success: true,
      hasPost: true,
      stats,
      body: {
        postContent: postData.postContent,
        freelanlyUrl: postData.freelanlyUrl,
        workType: postData.jobTitle,
        companyName: postData.companyName,
        languages: postData.skills,
        jobId: postData.jobId,
        queueItemId: postData.queueItemId,
      },
    });
  } catch (error) {
    console.error('[Cron] Social post error:', error);
    return NextResponse.json(
      { error: 'Failed to process social post', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Mark post as completed or failed (called by n8n after posting)
 */
export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { queueItemId, status, error } = await request.json();

    if (!queueItemId) {
      return NextResponse.json({ error: 'queueItemId required' }, { status: 400 });
    }

    if (status === 'posted') {
      await markAsPosted(queueItemId);
      return NextResponse.json({ success: true, message: 'Marked as posted' });
    } else if (status === 'failed') {
      await markAsFailed(queueItemId, error || 'Unknown error');
      return NextResponse.json({ success: true, message: 'Marked as failed' });
    }

    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
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
