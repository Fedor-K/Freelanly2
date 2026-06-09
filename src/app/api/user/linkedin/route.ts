import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { scrapeLinkedInProfile, mergeCandidateProfiles } from '@/lib/linkedin-profile';

/**
 * POST /api/user/linkedin  { url: string }
 * Authenticated LinkedIn enrichment (onboarding / settings). LinkedIn is a COMPLEMENT: it merges
 * into the user's EXISTING profile (résumé-derived stays the base) and always stores the URL as a
 * credibility signal — even if the scrape returns nothing.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { url } = await request.json();
    if (!url || typeof url !== 'string' || !url.includes('linkedin.com/in/')) {
      return NextResponse.json({ error: 'A valid LinkedIn profile URL (linkedin.com/in/...) is required' }, { status: 400 });
    }

    const email = session.user.email || '';
    const { liProfile, resolvedUrl, photoUrl } = await scrapeLinkedInProfile(url, email);

    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { parsedProfile: true } });
    const existing = (user?.parsedProfile as Record<string, unknown>) || null;
    // Existing profile (résumé) is the base; LinkedIn enriches it. Never overwrites the résumé.
    const merged = mergeCandidateProfiles(existing, liProfile, email);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        linkedinUrl: resolvedUrl || url, // always store the URL (credibility signal), scrape or not
        ...(merged ? { parsedProfile: merged as Prisma.InputJsonValue } : {}),
        ...(photoUrl ? { image: photoUrl } : {}),
      },
    });

    return NextResponse.json({ ok: true, enriched: !!liProfile });
  } catch (e) {
    console.error('[user/linkedin] failed:', e);
    return NextResponse.json({ error: 'Failed to import LinkedIn' }, { status: 500 });
  }
}
