import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateCoverLetter, generateSubjectLine, stripTrailingSignoff } from '@/services/cover-letter-generator';
import { checkPartnerSecret } from '../_lib/partner';

/**
 * POST /api/partner/draft — draft a cover letter + subject for a user↔opportunity pair.
 * Body: { userId, opportunityId }
 * Watcher users picked the role manually from their own niche feed, so no matcher
 * gate here — the same trust the engine gives a manual feed click.
 */
export async function POST(request: NextRequest) {
  if (!checkPartnerSecret(request)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const { userId, opportunityId } = await request.json();
    if (!userId || !opportunityId) {
      return NextResponse.json({ error: 'userId and opportunityId required' }, { status: 400 });
    }

    const [user, opportunity] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, parsedProfile: true, resumeText: true, workPreference: true, resumeUrl: true },
      }),
      prisma.opportunity.findUnique({
        where: { id: opportunityId },
        select: { id: true, title: true, description: true, clientName: true, posterCompany: true, applyEmail: true, isActive: true },
      }),
    ]);
    if (!user) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    if (!opportunity) return NextResponse.json({ error: 'opportunity_not_found' }, { status: 404 });
    if (!opportunity.applyEmail) return NextResponse.json({ error: 'no_apply_email' }, { status: 409 });
    if (!user.resumeUrl && !user.parsedProfile) return NextResponse.json({ error: 'no_resume' }, { status: 409 });

    const existing = await prisma.autoApplication.findFirst({
      where: { userId, opportunityId, sentAt: { not: null } },
      select: { id: true, sentAt: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'already_applied', sentAt: existing.sentAt }, { status: 409 });
    }

    const profile = (user.parsedProfile as Record<string, unknown> | null) || {};
    const companyName = opportunity.posterCompany || opportunity.clientName || 'the team';
    const userName = user.name || String(profile.name || '') || 'Applicant';

    const letterRaw = await generateCoverLetter({
      jobTitle: opportunity.title,
      jobDescription: opportunity.description,
      companyName,
      userProfile: {
        name: userName,
        skills: Array.isArray(profile.skills) ? (profile.skills as string[]) : [],
        experience: String(profile.summary || profile.experience || ''),
        resumeText: user.resumeText || undefined,
        workPreference: user.workPreference || undefined,
      },
    });
    const coverLetter = stripTrailingSignoff(letterRaw, userName);
    const subject = await generateSubjectLine({
      jobTitle: opportunity.title,
      userName,
    });

    return NextResponse.json({ coverLetter, subject });
  } catch (e) {
    return NextResponse.json({ error: 'internal', message: e instanceof Error ? e.message : 'unknown' }, { status: 500 });
  }
}
