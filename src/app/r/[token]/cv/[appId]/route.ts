import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';
import { buildResumeHtml, hasRenderableCv, type CvProfile } from '@/lib/recruiter-cv';

// GET /r/[token]/cv/[appId]
// Serves the candidate's CV to the recruiter who owns the application:
//  - real stored PDF (Blob)  → redirect to the original file
//  - legacy "uploaded:" only  → render an HTML résumé from the parsed profile
// Gated by the same signed recruiter token as the portal; only the recruiter the
// application was sent to (appliedToEmail) can open it.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string; appId: string }> }) {
  const { token, appId } = await params;
  const email = verifyRecruiterToken(token);
  if (!email) return new NextResponse('Link expired or invalid', { status: 403 });

  const app = await prisma.autoApplication.findUnique({
    where: { id: appId },
    select: {
      appliedToEmail: true,
      user: { select: { name: true, parsedProfile: true, resumeUrl: true } },
    },
  });

  // Ownership check — the application must have been sent to this recruiter.
  if (!app || app.appliedToEmail?.toLowerCase().trim() !== email.toLowerCase().trim()) {
    return new NextResponse('Not found', { status: 404 });
  }

  // Real stored PDF → serve the original.
  const resumeUrl = app.user.resumeUrl || '';
  if (resumeUrl.includes('blob.vercel-storage')) {
    return NextResponse.redirect(resumeUrl, 302);
  }

  // Legacy / no file → reconstruct from the parsed profile.
  const profile = (app.user.parsedProfile ?? null) as CvProfile | null;
  if (!hasRenderableCv(profile)) {
    return new NextResponse('No CV available for this candidate', { status: 404 });
  }

  return new NextResponse(buildResumeHtml(profile as CvProfile, app.user.name || undefined), {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, max-age=300' },
  });
}
