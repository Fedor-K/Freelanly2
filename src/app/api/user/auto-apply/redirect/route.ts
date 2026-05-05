import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/auto-apply/redirect?appId=xxx
 * Redirects to the original job/opportunity page
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  const appId = request.nextUrl.searchParams.get('appId');
  if (!appId) {
    return NextResponse.redirect(new URL('/dashboard/auto-apply', request.url));
  }

  const app = await prisma.autoApplication.findFirst({
    where: { id: appId, userId: session.user.id },
    select: { opportunityId: true, jobId: true },
  });

  if (!app) {
    return NextResponse.redirect(new URL('/dashboard/auto-apply', request.url));
  }

  if (app.opportunityId) {
    const opp = await prisma.opportunity.findUnique({
      where: { id: app.opportunityId },
      select: { slug: true },
    });
    if (opp) {
      return NextResponse.redirect(new URL(`/freelance/${opp.slug}`, request.url));
    }
  }

  if (app.jobId) {
    const job = await prisma.job.findUnique({
      where: { id: app.jobId },
      select: { slug: true, company: { select: { slug: true } } },
    });
    if (job) {
      return NextResponse.redirect(new URL(`/company/${job.company.slug}/jobs/${job.slug}`, request.url));
    }
  }

  return NextResponse.redirect(new URL('/dashboard/auto-apply', request.url));
}
