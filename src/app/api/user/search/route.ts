import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const q = request.nextUrl.searchParams.get('q')?.trim();
    if (!q || q.length < 2) return NextResponse.json({ results: [] });

    // Search user's applications
    const applications = await prisma.autoApplication.findMany({
      where: {
        userId: session.user.id,
        OR: [
          { jobTitle: { contains: q, mode: 'insensitive' } },
          { companyName: { contains: q, mode: 'insensitive' } },
          { subject: { contains: q, mode: 'insensitive' } },
          { appliedToEmail: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, jobTitle: true, companyName: true, status: true },
    });

    // Search all opportunities
    const opportunities = await prisma.opportunity.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { clientName: { contains: q, mode: 'insensitive' } },
          { skills: { hasSome: [q] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, clientName: true, createdAt: true, company: { select: { name: true } } },
    });

    // Search all jobs
    const jobs = await prisma.job.findMany({
      where: {
        isActive: true,
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { skills: { hasSome: [q] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, title: true, createdAt: true, company: { select: { name: true } } },
    });

    const results = [
      ...applications.map(a => ({ id: a.id, type: 'application' as const, jobTitle: a.jobTitle, companyName: a.companyName, status: a.status })),
      ...opportunities.map(o => ({ id: o.id, type: 'opportunity' as const, jobTitle: o.title, companyName: o.company?.name || o.clientName || '', status: 'OPPORTUNITY' })),
      ...jobs.map(j => ({ id: j.id, type: 'job' as const, jobTitle: j.title, companyName: j.company?.name || '', status: 'JOB' })),
    ];

    return NextResponse.json({ results });
  } catch (error) {
    console.error('[Search] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
