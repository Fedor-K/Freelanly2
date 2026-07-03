import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine } from '@/services/cover-letter-generator';
import { assessPairing } from '@/services/matching/assess-pairing';
import { hasRealCV } from '@/lib/resume-attachment';
import { buildGateEvidence, buildLetterEvidence, type ReviewRow } from '@/lib/github-review/evidence';
import { logActivity, ActivityAction } from '@/lib/activity-log';

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

    const { opportunityId, style } = await request.json();
    // style: "professional" (default), "casual", "short"
    if (!opportunityId) {
      return NextResponse.json({ error: 'opportunityId required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, resumeText: true, resumeUrl: true, parsedProfile: true, githubUrl: true, githubReview: { select: { verdict: true, report: true, profileStamp: true, reviewedAt: true } } },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.resumeText && !user.parsedProfile) {
      return NextResponse.json({ error: 'resume_required', message: 'Upload your resume first.' }, { status: 400 });
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true, title: true, description: true, clientName: true, applyEmail: true, skills: true },
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
    const ghUser = { githubUrl: user.githubUrl, parsedProfile: user.parsedProfile };
    const ghReview = (user.githubReview as ReviewRow | null) ?? null;

    // Same verifier + gate + verdict as the matcher → the draft is honest (no over-promising on a
    // missing/weak requirement). Draft is a preview, so the gate decision is surfaced, not enforced.
    const pairing = await assessPairing({
      jobTitle: opportunity.title, jobDescription: opportunity.description, jobCountry: null,
      profile, cvText: user.resumeText || '', hasRealCV: hasRealCV(user),
      githubEvidence: buildGateEvidence(ghUser, ghReview),
    });

    // Style-specific prompt override
    const stylePrompts: Record<string, string> = {
      professional: 'Write a 3-5 sentence professional cover letter body. Mention relevant skills and experience. No greeting or signature.',
      casual: 'Write a 2-3 sentence casual, friendly cover letter. Sound like a real person, not a template. Reference the job specifics. No greeting or signature.',
      short: 'Write a 1-2 sentence ultra-short pitch. Get straight to the point — why you\'re a fit. No greeting or signature. Under 50 words.',
    };

    // GitHub line in letters: shadow by default (compute + log, don't emit) until GITHUB_LETTERS=on.
    const letterEvidence = buildLetterEvidence(ghUser, ghReview, opportunity.skills);
    if (letterEvidence && process.env.GITHUB_LETTERS !== 'on') {
      logActivity({ userId: session.user.id, action: ActivityAction.FUNNEL_STEP, details: { step: 'gh_letter_shadow', line: letterEvidence, opportunityId: opportunity.id } }).catch(() => {});
    }
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
      styleOverride: stylePrompts[style || 'professional'],
      verdict: pairing.verdict, // honest mode + missing-strip
      githubEvidence: process.env.GITHUB_LETTERS === 'on' ? letterEvidence : null,
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
      match: { label: pairing.label ?? null, decision: pairing.decision, reason: pairing.reason },
    });
  } catch (error) {
    console.error('[DraftApply] Error:', error);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}
