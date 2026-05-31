import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/db';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';
import { hasRenderableCv, type CvProfile } from '@/lib/recruiter-cv';
import { generateCvPdf } from '@/lib/generate-cv-pdf';

export const maxDuration = 300;

// Backfills a generated PDF résumé for candidates who have NO attachable CV (resumeUrl is not
// a Vercel Blob — legacy uploads, pasted LinkedIn URLs, or the portfolio route overwriting it).
// Without a Blob PDF the auto-apply email goes out with no attachment, and CV is the #1 thing
// recruiters re-ask for. We generate one from parsedProfile, store it as a Blob, and point
// resumeUrl at it — so the unchanged worker send-path (fetchResumeAttachment) attaches it.
//
// Self-healing: runs on a schedule and picks up any new user who lacks a Blob CV. Idempotent —
// a user with a Blob resumeUrl is never touched. The generated file is named so a recruiter can
// tell it apart, and resumeGenerated flags it as auto-built (not the candidate's own upload).
const BATCH = 60;

export async function GET(request: NextRequest) {
  return run(request);
}
export async function POST(request: NextRequest) {
  return run(request);
}

async function run(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Candidates we actually apply for (have an AutoApplication) but whose resumeUrl is not a Blob.
  // Ordering by most-recently-active first so the highest-value profiles get a CV soonest.
  const candidates = await prisma.user.findMany({
    where: {
      OR: [{ resumeUrl: null }, { NOT: { resumeUrl: { contains: 'blob.vercel-storage' } } }],
      autoApplications: { some: {} }, // only candidates we actually apply for
    },
    orderBy: { lastActiveAt: 'desc' },
    take: BATCH,
    select: { id: true, name: true, parsedProfile: true },
  });

  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const u of candidates) {
    const profile = (u.parsedProfile ?? null) as CvProfile | null;
    if (!hasRenderableCv(profile)) {
      skipped++;
      continue;
    }
    try {
      const pdf = await generateCvPdf(profile as CvProfile, u.name || undefined);
      if (!pdf) {
        skipped++;
        continue;
      }
      const safeName = (u.name || 'candidate').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'candidate';
      const filename = `${safeName}-resume.pdf`;
      const blob = await put(`resumes/${u.id}/generated-${filename}`, pdf, {
        access: 'public',
        contentType: 'application/pdf',
        allowOverwrite: true,
      });
      await prisma.user.update({
        where: { id: u.id },
        data: { resumeUrl: blob.url, resumeFileName: filename, resumeGenerated: true },
      });
      generated++;
    } catch (e) {
      errors.push(`${u.id}: ${String(e).slice(0, 120)}`);
    }
  }

  return NextResponse.json({
    scanned: candidates.length,
    generated,
    skipped,
    errors: errors.slice(0, 10),
    note: candidates.length === BATCH ? 'more remain — run again' : 'batch drained',
  });
}
