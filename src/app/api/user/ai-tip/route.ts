import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/ai-tip
 * Returns a personalized tip based on user's auto-apply data.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get user stats
    const stats = await prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId },
      _count: { status: true },
    });

    const sent = stats.reduce((sum, s) => {
      if (['SENT', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'].includes(s.status)) {
        return sum + s._count.status;
      }
      return sum;
    }, 0);
    const replied = stats.find(s => s.status === 'REPLIED')?._count.status || 0;
    const opened = stats.find(s => s.status === 'OPENED')?._count.status || 0;
    const interviews = stats.find(s => s.status === 'INTERVIEW')?._count.status || 0;
    const pending = stats.find(s => s.status === 'PENDING')?._count.status || 0;
    const rejected = stats.find(s => s.status === 'REJECTED')?._count.status || 0;

    const replyRate = sent > 0 ? ((replied + interviews) / sent * 100) : 0;
    const openRate = sent > 0 ? (opened / sent * 100) : 0;

    // Check user profile completeness
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { resumeText: true, parsedProfile: true, userSmtp: { select: { verified: true } } },
    });

    const hasResume = !!user?.resumeText;
    const hasSmtp = !!user?.userSmtp?.verified;
    const profile = user?.parsedProfile as Record<string, unknown> | null;
    const skillCount = (profile?.skills as string[])?.length || 0;

    // Generate tip based on data
    let tip: { text: string; action?: string; actionLabel?: string } | null = null;

    if (sent === 0) {
      tip = { text: 'Your auto-apply is set up! Applications will start going out as matching projects appear.', action: '/dashboard', actionLabel: 'View settings' };
    } else if (!hasResume) {
      tip = { text: 'Upload your resume to improve match quality and get more personalized cover letters.', action: '/dashboard', actionLabel: 'Upload resume' };
    } else if (!hasSmtp && sent > 10) {
      tip = { text: `Your reply rate is ${replyRate.toFixed(1)}%. Connect your Gmail for better deliverability — emails from personal inboxes get 2-3x more replies.`, action: '/dashboard', actionLabel: 'Connect Gmail' };
    } else if (replyRate > 8) {
      tip = { text: `Your reply rate is ${replyRate.toFixed(1)}% — that's above average! ${replied + interviews} recruiters responded out of ${sent} applications.` };
    } else if (replyRate > 3 && replyRate <= 8) {
      tip = { text: `${replied} replies from ${sent} applications (${replyRate.toFixed(1)}%). Tip: applications sent in the morning tend to get more opens.` };
    } else if (sent > 20 && replyRate <= 3) {
      tip = { text: `${sent} applications sent but only ${replied} replies (${replyRate.toFixed(1)}%). Try adding more relevant skills to your resume to improve match quality.`, action: '/dashboard', actionLabel: 'Update profile' };
    } else if (skillCount < 5 && sent > 5) {
      tip = { text: `Your profile has ${skillCount} skills listed. Adding more skills helps AI write better cover letters and match more accurately.`, action: '/dashboard', actionLabel: 'Update profile' };
    } else if (openRate > 50 && replyRate < 5) {
      tip = { text: `${openRate.toFixed(0)}% of recruiters open your emails but only ${replyRate.toFixed(1)}% reply. Your subject lines work — try making cover letters more specific to each role.` };
    } else if (pending > 20) {
      tip = { text: `${pending} applications queued. They'll be sent automatically as the system processes them.` };
    } else {
      tip = { text: `${sent} applications sent, ${replied} replies, ${opened} opened. Keep going — consistency is key!` };
    }

    return NextResponse.json({ tip, stats: { sent, replied, opened, interviews, rejected, pending, replyRate: replyRate.toFixed(1), openRate: openRate.toFixed(0) } });
  } catch (error) {
    console.error('[AITip] Error:', error);
    return NextResponse.json({ tip: null }, { status: 500 });
  }
}
