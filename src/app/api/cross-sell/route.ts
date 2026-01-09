import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type'); // 'job' or 'opportunity'
  const category = searchParams.get('category');
  const limit = Math.min(parseInt(searchParams.get('limit') || '3', 10), 5);

  if (!type || !['job', 'opportunity'].includes(type)) {
    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  }

  const maxAgeDate = getMaxJobAgeDate();

  try {
    if (type === 'job') {
      // Fetch jobs
      const where: any = {
        isActive: true,
        postedAt: { gte: maxAgeDate },
      };

      if (category) {
        where.category = { slug: category };
      }

      const jobs = await prisma.job.findMany({
        where,
        include: {
          company: {
            select: {
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const items = jobs.map((job) => ({
        id: job.id,
        slug: job.slug,
        title: job.title,
        type: 'job' as const,
        companyName: job.company.name,
        companySlug: job.company.slug,
        companyLogo: job.company.logo,
        location: job.location,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
      }));

      return NextResponse.json({ items });
    } else {
      // Fetch opportunities
      const where: any = {
        isActive: true,
        postedAt: { gte: maxAgeDate },
      };

      if (category) {
        where.category = { slug: category };
      }

      const opportunities = await prisma.opportunity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      const items = opportunities.map((opp) => ({
        id: opp.id,
        slug: opp.slug,
        title: opp.title,
        type: 'opportunity' as const,
        clientName: opp.clientName,
        clientAvatar: opp.clientAvatar,
        location: opp.location,
        salaryMin: opp.salaryMin,
        salaryMax: opp.salaryMax,
        salaryCurrency: opp.salaryCurrency,
      }));

      return NextResponse.json({ items });
    }
  } catch (error) {
    console.error('Cross-sell API error:', error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  }
}
