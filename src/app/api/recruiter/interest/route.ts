import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';
import { sendEmail } from '@/lib/email';

/**
 * "I'm interested, I want to hire" — the recruiter landing's single CTA. Records the demand signal
 * (RECRUITER_INTEREST) for the recruiter behind the token and pings the founder so he can follow up
 * and make the intro. No login, no cabinet — this is the whole recruiter funnel for now.
 */
export async function POST(request: NextRequest) {
  const { token } = await request.json().catch(() => ({ token: '' }));
  const email = token ? verifyRecruiterToken(token) : null;
  if (!email) return NextResponse.json({ error: 'invalid token' }, { status: 400 });

  const recruiter = await prisma.recruiter.findUnique({ where: { email }, select: { company: true } }).catch(() => null);
  const company = recruiter?.company || (email.split('@')[1] || '').split('.')[0] || '';

  // How many candidates were shown to this recruiter (context for the follow-up).
  const candidateCount = await prisma.autoApplication.count({
    where: { appliedToEmail: { equals: email, mode: 'insensitive' }, recruiterHidden: false, OR: [{ sentAt: { not: null } }, { origin: 'SHORTLIST' }] },
  }).catch(() => 0);

  await prisma.activityLog.create({
    data: { action: 'RECRUITER_INTEREST', details: { recruiterEmail: email, company, candidateCount } },
  }).catch(() => {});

  // Notify the founder (best-effort). Set RECRUITER_NOTIFY_EMAIL; falls back to the Postal from-addr.
  const notify = process.env.RECRUITER_NOTIFY_EMAIL || process.env.POSTAL_FROM_EMAIL;
  if (notify) {
    sendEmail({
      to: notify, subject: `🔥 Recruiter interested: ${company || email}`,
      html: `<p><strong>${email}</strong>${company ? ` (${company})` : ''} clicked "I want to hire" on their candidate shortlist (${candidateCount} candidates).</p><p>Follow up to make the intro.</p>`,
      text: `${email}${company ? ` (${company})` : ''} clicked "I want to hire" on their shortlist (${candidateCount} candidates). Follow up to make the intro.`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
