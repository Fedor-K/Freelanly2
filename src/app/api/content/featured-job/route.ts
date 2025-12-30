import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/content/featured-job
 * Returns a random featured job for social media content
 *
 * Query params:
 * - category: filter by category slug (optional)
 * - withSalary: only jobs with salary (default: true)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const withSalary = searchParams.get('withSalary') !== 'false';

    // Get recent jobs (last 3 days) with good data
    const jobs = await prisma.job.findMany({
      where: {
        postedAt: {
          gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        },
        ...(withSalary && { salaryMin: { not: null } }),
        ...(category && {
          category: { slug: category },
        }),
      },
      include: {
        company: true,
        category: true,
      },
      orderBy: { postedAt: 'desc' },
      take: 20,
    });

    if (jobs.length === 0) {
      return NextResponse.json(
        { error: 'No jobs found matching criteria' },
        { status: 404 }
      );
    }

    // Pick random job from top 20
    const job = jobs[Math.floor(Math.random() * jobs.length)];

    // Format salary
    let salary = null;
    if (job.salaryMin || job.salaryMax) {
      const currency = job.salaryCurrency || 'USD';
      const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
      const formatNum = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}K` : n.toString();

      const periodMap: Record<string, string> = {
        HOUR: '/hr', DAY: '/day', WEEK: '/wk', MONTH: '/mo', YEAR: '/yr',
      };
      const period = periodMap[job.salaryPeriod] || '/yr';

      if (job.salaryMin && job.salaryMax) {
        salary = `${symbol}${formatNum(job.salaryMin)}-${formatNum(job.salaryMax)}${period}`;
      } else if (job.salaryMin) {
        salary = `${symbol}${formatNum(job.salaryMin)}+${period}`;
      } else if (job.salaryMax) {
        salary = `Up to ${symbol}${formatNum(job.salaryMax)}${period}`;
      }
    }

    // Format location
    const location = job.location || (job.locationType === 'REMOTE' ? 'Remote' : 'Flexible');

    // Level display
    const levelMap: Record<string, string> = {
      INTERN: 'Internship', ENTRY: 'Entry Level', MID: 'Mid Level',
      SENIOR: 'Senior', LEAD: 'Lead', EXECUTIVE: 'Executive',
    };

    // Type display
    const typeMap: Record<string, string> = {
      FULL_TIME: 'Full-time', PART_TIME: 'Part-time', CONTRACT: 'Contract',
      FREELANCE: 'Freelance', INTERNSHIP: 'Internship',
    };

    return NextResponse.json({
      success: true,
      job: {
        id: job.id,
        slug: job.slug,
        title: job.title,
        company: job.company.name,
        companySlug: job.company.slug,
        companyLogo: job.company.logo,
        salary,
        location,
        locationType: job.locationType,
        level: levelMap[job.level] || job.level,
        type: typeMap[job.type] || job.type,
        category: job.category.name,
        categorySlug: job.category.slug,
        url: `https://freelanly.com/company/${job.company.slug}/jobs/${job.slug}`,
        postedAt: job.postedAt,
      },
    });
  } catch (error) {
    console.error('[FeaturedJob] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get featured job' },
      { status: 500 }
    );
  }
}
