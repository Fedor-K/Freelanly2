import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';
import { isFreeEmailProvider } from '@/lib/content-quality';

// POST /api/recruiter/register — first-touch recruiter registration from the /r/[token] portal.
// The signed token already proves control of the inbox (the link was emailed to them), so no OTP.
// Upserts a Recruiter row and logs a RECRUITER_PORTAL_ACTION{event:'registered'} so the form
// funnel (visit → registered) and the need data are queryable per-recruiter with no schema change.
const VOLUMES = new Set(['1', '2-5', '6-20', '20+']);
const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.trim().slice(0, n) : '');

export async function POST(request: NextRequest) {
  try {
    const { token, name, company, hiringFor, hiringVolume } = await request.json();
    const email = verifyRecruiterToken(token || '');
    if (!email) return NextResponse.json({ error: 'Invalid link' }, { status: 401 });

    // Demand-side gate (decision 2026-06): recruiters on free/personal email domains can't register.
    // The paying customer is a real company; a gmail "recruiter" is almost always a résumé-farm /
    // agency reposter. Block here so they never become a Recruiter row or reach the paywall.
    if (isFreeEmailProvider(email)) {
      return NextResponse.json({ error: 'Please register with your company email address — free inboxes (gmail, outlook, etc.) aren’t supported.' }, { status: 403 });
    }

    const data = {
      name: clip(name, 120) || null,
      company: clip(company, 120) || null,
      hiringFor: clip(hiringFor, 160) || null,
      hiringVolume: VOLUMES.has(hiringVolume) ? hiringVolume : null,
      lastSeenAt: new Date(),
    };

    await prisma.recruiter.upsert({
      where: { email },
      create: { email, ...data },
      update: data, // re-registration just refreshes their answers
    });

    const h = request.headers;
    await prisma.activityLog.create({
      data: {
        action: 'RECRUITER_PORTAL_ACTION',
        details: { recruiterEmail: email, event: 'registered', hiringFor: data.hiringFor, hiringVolume: data.hiringVolume },
        ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: h.get('user-agent') || null,
        country: h.get('x-vercel-ip-country') || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
