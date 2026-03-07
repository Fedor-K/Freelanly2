import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Internal API: check if a job exists and is active
// Returns redirect destination if job is inactive/missing
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug');
  if (!slug) {
    return NextResponse.json({ redirect: '/jobs' });
  }

  try {
    const job = await prisma.job.findUnique({
      where: { slug },
      select: { isActive: true, category: { select: { slug: true } } },
    });

    if (!job || !job.isActive) {
      const dest = job?.category?.slug ? `/jobs/${job.category.slug}` : '/jobs';
      return NextResponse.json({ redirect: dest });
    }

    return NextResponse.json({ redirect: null });
  } catch {
    return NextResponse.json({ redirect: null });
  }
}
