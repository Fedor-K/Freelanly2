import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';

// GET /go/ats/[id] — tracked redirect for ATS (external-apply) opportunities.
// The discovery feed's "Apply on company site" button points here instead of straight to Lever, so
// we can log who clicks through to an ATS role (the feed apply is external → no AutoApplication).
// Logs ATS_APPLY_CLICK, then 302s to the opportunity's applyUrl. Falls back to discovery on any miss.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const opp = await prisma.opportunity.findUnique({
    where: { id },
    select: { applyUrl: true, source: true, title: true, clientName: true, country: true },
  });

  if (!opp?.applyUrl) {
    return NextResponse.redirect(new URL('/dashboard/discovery', _req.url), 302);
  }

  try {
    const session = await auth();
    const h = await headers();
    await prisma.activityLog.create({
      data: {
        userId: session?.user?.id || null,
        action: 'ATS_APPLY_CLICK',
        details: { opportunityId: id, source: opp.source, company: opp.clientName, role: opp.title, country: opp.country },
        ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: h.get('user-agent') || null,
        country: h.get('x-vercel-ip-country') || null,
      },
    });
  } catch { /* tracking must never block the redirect */ }

  return NextResponse.redirect(opp.applyUrl, 302);
}
