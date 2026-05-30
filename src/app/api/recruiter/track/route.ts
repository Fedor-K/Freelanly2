import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';

// Whitelist of recruiter-portal interactions we track. Keeps the data clean / bounded.
const EVENTS = new Set(['open_chat', 'close_chat', 'view_cv', 'open_profile', 'send_click', 'list_view', 'reveal_contact']);

/**
 * POST /api/recruiter/track — log a recruiter-portal interaction (every button/function).
 * Stored in ActivityLog as RECRUITER_PORTAL_ACTION with userId = the candidate (so it's
 * queryable per-candidate) and details.recruiterEmail (so it's queryable per-recruiter).
 * Authed by signed token; appId is only honored if it belongs to this recruiter.
 */
export async function POST(request: NextRequest) {
  try {
    const { token, event, appId } = await request.json();
    const email = verifyRecruiterToken(token || '');
    if (!email) return NextResponse.json({ error: 'Invalid link' }, { status: 401 });
    if (!event || !EVENTS.has(event)) return NextResponse.json({ error: 'Unknown event' }, { status: 400 });

    // If an appId is given, confirm it's this recruiter's and capture the candidate userId.
    let candidateUserId: string | null = null;
    if (appId && typeof appId === 'string') {
      const app = await prisma.autoApplication.findUnique({
        where: { id: appId },
        select: { appliedToEmail: true, userId: true },
      });
      if (app && (app.appliedToEmail || '').toLowerCase() === email.toLowerCase()) {
        candidateUserId = app.userId;
      }
    }

    const h = request.headers;
    await prisma.activityLog.create({
      data: {
        userId: candidateUserId,
        action: 'RECRUITER_PORTAL_ACTION',
        details: { recruiterEmail: email, event, appId: appId || null },
        ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: h.get('user-agent') || null,
        country: h.get('x-vercel-ip-country') || null,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 200 }); // never break the UI over tracking
  }
}
