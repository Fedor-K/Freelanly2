import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine } from '@/services/cover-letter-generator';

/**
 * POST /api/user/draft-apply
 * Generate a cover letter draft WITHOUT sending.
 * Body: { opportunityId: string }
 * Returns: { coverLetter, subject, recruiterName, companyName }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { opportunityId } = await request.json();
    if (!opportunityId) {
      return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, resumeText: true, parsedProfile: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.resumeText && !user.parsedProfile) {
      return NextResponse.json({ error: 'resume_required', message: 'Upload your resume first.' }, { status: 400 });
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { title: true, description: true, clientName: true, applyEmail: true },
    });

    if (!opportunity || !opportunity.applyEmail) {
      return NextResponse.json({ error: 'Opportunity not found or no email' }, { status: 404 });
    }

    // Check already applied
    const existing = await prisma.autoApplication.findFirst({
      where: { userId: session.user.id, opportunityId },
    });
    if (existing) {
      return NextResponse.json({ error: 'already_applied', message: 'You already applied to this project.' }, { status: 409 });
    }

    const profile = user.parsedProfile as Record<string, unknown> | null;
    const recruiterFirstName = opportunity.clientName.split(' ')[0];

    const coverLetter = await generateCoverLetter({
      jobTitle: opportunity.title,
      jobDescription: opportunity.description.slice(0, 800),
      companyName: opportunity.clientName,
      userProfile: {
        name: user.name || 'Applicant',
        skills: (profile?.skills as string[]) || [],
        experience: (user.resumeText || '').slice(0, 300),
        resumeText: user.resumeText || undefined,
      },
    });

    const subject = await generateSubjectLine({
      jobTitle: opportunity.title,
      userName: user.name || 'Applicant',
    });

    const greeting = `Dear ${recruiterFirstName},`;
    const replyEmail = user.email;
    const signature = `Best regards,\n${user.name || 'Applicant'}\n${replyEmail}`;
    const fullLetter = `${greeting}\n\n${coverLetter}\n\n${signature}`;

    return NextResponse.json({
      coverLetter: fullLetter,
      subject,
      recruiterName: opportunity.clientName,
      applyEmail: opportunity.applyEmail,
    });
  } catch (error) {
    console.error('[DraftApply] Error:', error);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}
