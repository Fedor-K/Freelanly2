import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

// POST /api/user/profile-extra — two recruiter-requested profile fields, collected the same way
// as salary (optional, alongside résumé/profile, never a blocking popup):
//   availableFrom — when the candidate can start (27% of recruiters re-ask this); fixed options.
//   portfolioUrl  — portfolio / GitHub / site (14% re-ask); free URL the candidate enters.
// Both surface on the application card so the recruiter doesn't have to chase them.
const NOTICE = new Set(['Immediately', 'Within 2 weeks', 'Within a month', 'More than a month']);

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { availableFrom, portfolioUrl } = await request.json();
    const data: { availableFrom?: string; portfolioUrl?: string } = {};

    if (typeof availableFrom === 'string' && NOTICE.has(availableFrom)) data.availableFrom = availableFrom;

    if (typeof portfolioUrl === 'string') {
      const url = portfolioUrl.trim().slice(0, 300);
      if (url) {
        const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        try { new URL(normalized); data.portfolioUrl = normalized; } catch { /* ignore malformed */ }
      }
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 });
    await prisma.user.update({ where: { id: session.user.id }, data });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'bad input' }, { status: 400 });
  }
}
