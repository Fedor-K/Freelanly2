import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';

/**
 * POST /api/recruiter/reveal — recruiter reveals a candidate's real contact from the portal.
 *
 * Shadow paywall (Wave 2): every reveal is recorded in ContactReveal. During validation it is
 * FREE and unlimited — but logged — so we learn who reveals and how often before charging. When
 * monetization flips on, this is where the payment gate goes (first reveal free, then paid).
 *
 * All outreach is brokered through Postal with the candidate's email stripped from the body, so
 * the recruiter has no way to contact the candidate directly until they reveal here. The recruiter
 * is authenticated by the signed token and may only reveal candidates who applied to their email.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, applicationId } = await request.json();
    const email = verifyRecruiterToken(token || '');
    if (!email) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 401 });
    if (!applicationId) return NextResponse.json({ error: 'applicationId required' }, { status: 400 });

    const app = await prisma.autoApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, appliedToEmail: true, user: { select: { email: true, name: true } } },
    });
    // Authorization: recruiter can only reveal candidates who applied to their own email.
    if (!app || (app.appliedToEmail || '').toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const recruiterEmail = email.toLowerCase();
    // Idempotent: re-revealing the same candidate doesn't double-count (one row per pair).
    await prisma.contactReveal.upsert({
      where: { applicationId_recruiterEmail: { applicationId, recruiterEmail } },
      create: { applicationId, recruiterEmail },
      update: {},
    });

    // MONETIZATION OFF (validation): return the real contact for free. Re-add a payment gate here.
    return NextResponse.json({ email: app.user.email, name: app.user.name });
  } catch (e) {
    console.error('[RecruiterReveal] error:', e);
    return NextResponse.json({ error: 'Failed to reveal' }, { status: 500 });
  }
}
