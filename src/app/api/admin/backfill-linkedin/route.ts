import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { checkAdminSession } from '@/lib/admin-auth';
import { scrapeLinkedInProfile, mergeCandidateProfiles } from '@/lib/linkedin-profile';

/**
 * GET /api/admin/backfill-linkedin?limit=N
 * Re-scrapes the saved linkedinUrl for users who gave one but were never enriched (the historical
 * scrape returned nothing), and merges the LinkedIn data into their résumé profile. Idempotent:
 * each done user is marked parsedProfile._liScraped=true and skipped next time. Runs on prod where
 * APIFY_API_TOKEN is valid. limit capped (serverless timeout) — call repeatedly to drain.
 */
async function countRemaining(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ c: number }>>`
    SELECT count(*)::int AS c FROM "User"
    WHERE "linkedinUrl" IS NOT NULL
      AND COALESCE(("parsedProfile"->>'_liScraped')::boolean, false) = false`;
  return Number(rows[0]?.c ?? 0);
}

export async function GET(request: NextRequest) {
  const denied = await checkAdminSession(request);
  if (denied) return denied;

  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get('limit') || 3), 1), 8);

  // COALESCE handles the absent-key case (no marker yet) → treated as not-done. (A plain JSON
  // `NOT path equals true` filter returns NULL for missing keys and silently excludes everyone.)
  const todo = await prisma.$queryRaw<Array<{ id: string; email: string | null; linkedinUrl: string | null; parsedProfile: unknown }>>`
    SELECT id, email, "linkedinUrl", "parsedProfile" FROM "User"
    WHERE "linkedinUrl" IS NOT NULL
      AND COALESCE(("parsedProfile"->>'_liScraped')::boolean, false) = false
    ORDER BY "createdAt" DESC LIMIT ${limit}`;

  let enriched = 0;
  let empty = 0;
  const samples: Array<Record<string, unknown>> = [];

  for (const u of todo) {
    try {
      const { liProfile, resolvedUrl, photoUrl } = await scrapeLinkedInProfile(u.linkedinUrl!, u.email || '');
      const existing = (u.parsedProfile as Record<string, unknown> | null) || null;
      const merged = (mergeCandidateProfiles(existing, liProfile, u.email || '') || existing || {}) as Record<string, unknown>;
      merged._liScraped = true;
      merged._liScrapedAt = new Date().toISOString();
      await prisma.user.update({
        where: { id: u.id },
        data: {
          parsedProfile: merged as Prisma.InputJsonValue,
          ...(merged.location ? { location: String(merged.location) } : {}),
          ...(resolvedUrl ? { linkedinUrl: resolvedUrl } : {}),
          ...(photoUrl ? { image: photoUrl } : {}),
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

  return NextResponse.json({ processed: todo.length, enriched, empty, remaining: await countRemaining(), samples });
}
