import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { checkAdminSession } from '@/lib/admin-auth';
import { scrapeLinkedInProfile, mergeCandidateProfiles } from '@/lib/linkedin-profile';

/**
 * GET /api/admin/backfill-linkedin?limit=N
 * Re-scrapes the saved linkedinUrl for users who gave one but were never enriched (the historical
 * scrape returned nothing), and merges the LinkedIn data into their résumé profile. Idempotent:
 * each done user is marked parsedProfile._liScraped=true and skipped next time.
 *
 * Runs on prod where APIFY_API_TOKEN is valid. limit is capped (serverless timeout) — call
 * repeatedly to drain. Start with ?limit=1 as a smoke test.
 */
export async function GET(request: NextRequest) {
  const denied = await checkAdminSession(request);
  if (denied) return denied;

  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') || 3), 1), 8);

  const users = await prisma.user.findMany({
    where: {
      linkedinUrl: { not: null },
      NOT: { parsedProfile: { path: ['_liScraped'], equals: true } },
    },
    select: { id: true, email: true, linkedinUrl: true, parsedProfile: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  let enriched = 0;
  let empty = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const u of users) {
    try {
      const { liProfile, resolvedUrl } = await scrapeLinkedInProfile(u.linkedinUrl!, u.email || '');
      const existing = (u.parsedProfile as Record<string, unknown> | null) || null;
      // Existing (résumé) is the base; LinkedIn enriches. Always mark done so we don't re-scrape.
      const merged = (mergeCandidateProfiles(existing, liProfile, u.email || '') || existing || {}) as Record<string, unknown>;
      merged._liScraped = true;
      merged._liScrapedAt = new Date().toISOString();
      await prisma.user.update({
        where: { id: u.id },
        data: {
          parsedProfile: merged as Prisma.InputJsonValue,
          ...(resolvedUrl ? { linkedinUrl: resolvedUrl } : {}),
        },
      });
      if (liProfile) {
        enriched++;
        if (samples.length < 3) samples.push({
          email: u.email,
          headline: liProfile.current_title,
          skills: (liProfile.skills as string[] | undefined)?.length || 0,
          experience: (liProfile.experience as unknown[] | undefined)?.length || 0,
          languages: liProfile.languages,
        });
      } else {
        empty++;
      }
    } catch (e) {
      console.error('[backfill-linkedin] failed for', u.email, e);
    }
  }

  const remaining = await prisma.user.count({
    where: { linkedinUrl: { not: null }, NOT: { parsedProfile: { path: ['_liScraped'], equals: true } } },
  });

  return NextResponse.json({ processed: users.length, enriched, empty, remaining, samples });
}
