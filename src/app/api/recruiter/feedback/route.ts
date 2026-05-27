import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';

// In-portal satisfaction questions (kept short — one tap each). Logged to ActivityLog as a
// RECRUITER_PORTAL_ACTION with details.event='feedback' so it's queryable per-recruiter
// alongside the rest of the funnel, with no schema change.
const QUESTIONS = new Set(['relevance', 'satisfaction', 'wishlist']);

export async function POST(request: NextRequest) {
  try {
    const { token, question, answer } = await request.json();
    const email = verifyRecruiterToken(token || '');
    if (!email) return NextResponse.json({ error: 'Invalid link' }, { status: 401 });
    if (!question || !QUESTIONS.has(question) || typeof answer !== 'string' || !answer || answer.length > 80) {
      return NextResponse.json({ error: 'bad input' }, { status: 400 });
    }

    const h = request.headers;
    await prisma.activityLog.create({
      data: {
        action: 'RECRUITER_PORTAL_ACTION',
        details: { recruiterEmail: email, event: 'feedback', question, answer },
        ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: h.get('user-agent') || null,
        country: h.get('x-vercel-ip-country') || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 }); // never break the UI
  }
}
