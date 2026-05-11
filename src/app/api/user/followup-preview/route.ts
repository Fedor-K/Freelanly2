import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateFollowUp } from '@/services/cover-letter-generator';

/**
 * POST /api/user/followup-preview
 * Preview what the follow-up email will look like.
 * Body: { jobTitle, companyName, daysSinceSent? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jobTitle, companyName, daysSinceSent } = await request.json();

    const userName = session.user.name || 'Applicant';
    const followUpBody = await generateFollowUp({
      jobTitle: jobTitle || 'this position',
      companyName: companyName || 'your company',
      userName,
      daysSinceSent: daysSinceSent || 3,
    });

    return NextResponse.json({
      subject: `Re: Application for ${jobTitle}`,
      body: followUpBody,
      fullText: `Dear ${companyName.split(' ')[0]},\n\n${followUpBody}\n\nBest regards,\n${userName}`,
      timing: 'Sent automatically 3 days after initial application if no reply',
      maxFollowUps: 1,
      stopsOnReply: true,
    });
  } catch (error) {
    console.error('[FollowupPreview] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
