import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Get cancellation feedback stats
 * Admin pages are protected by middleware/layout
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.CRON_SECRET;
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get all feedback
    const allFeedback = await prisma.cancellationFeedback.findMany({
      include: {
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Count by reason
    const reasonCounts = await prisma.cancellationFeedback.groupBy({
      by: ['reason'],
      _count: true,
      orderBy: {
        _count: {
          reason: 'desc',
        },
      },
    });

    // Format reason labels
    const reasonLabels: Record<string, string> = {
      TOO_EXPENSIVE: '💰 Too expensive',
      NOT_ENOUGH_JOBS: '📋 Not enough jobs',
      FOUND_JOB: '🎉 Found a job',
      NOT_USING: '⏰ Not using enough',
      MISSING_FEATURES: '🔧 Missing features',
      TECHNICAL_ISSUES: '🐛 Technical issues',
      POOR_JOB_QUALITY: '🎯 Poor job quality',
      OTHER: '💬 Other',
    };

    const stats = {
      total: allFeedback.length,
      byReason: reasonCounts.map((r) => ({
        reason: r.reason,
        label: reasonLabels[r.reason] || r.reason,
        count: r._count,
        percent: allFeedback.length > 0
          ? ((r._count / allFeedback.length) * 100).toFixed(1)
          : '0',
      })),
    };

    // Recent feedback with details
    const recentFeedback = allFeedback.slice(0, 20).map((f) => ({
      id: f.id,
      email: f.user.email,
      reason: reasonLabels[f.reason] || f.reason,
      otherText: f.otherText,
      feedback: f.feedback,
      plan: f.planAtCancellation,
      createdAt: f.createdAt,
    }));

    return NextResponse.json({
      success: true,
      stats,
      recentFeedback,
    });
  } catch (error) {
    console.error('[CancellationFeedback] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get feedback', details: String(error) },
      { status: 500 }
    );
  }
}
