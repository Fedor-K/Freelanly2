import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/content/top-jobs
 * Returns top jobs for carousel/listicle content
 *
 * Query params:
 * - limit: number of jobs (default: 5, max: 10)
 * - category: filter by category slug (optional)
 * - minSalary: minimum salary filter (optional)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10);
    const category = searchParams.get('category');
    const minSalary = parseInt(searchParams.get('minSalary') || '0');

    // Get top jobs by salary
    const jobs = await prisma.job.findMany({
      where: {
        salaryMin: { gte: minSalary || 1 }, // Must have salary
        salaryPeriod: 'YEAR', // Annual salaries for comparison
        postedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
        ...(category && {
          category: { slug: category },
        }),
      },
      include: {
        company: true,
        category: true,
      },
      orderBy: { salaryMax: 'desc' },
      take: limit,
    });

    if (jobs.length === 0) {
      return NextResponse.json(
        { error: 'No jobs found matching criteria' },
        { status: 404 }
      );
    }

    // Format jobs
    const formattedJobs = jobs.map((job, index) => {
      const currency = job.salaryCurrency || 'USD';
      const symbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
      const salary = job.salaryMax || job.salaryMin || 0;
      const salaryK = `${symbol}${Math.round(salary / 1000)}K`;

      return {
        rank: index + 1,
        id: job.id,
        slug: job.slug,
        title: job.title,
        company: job.company.name,
        companyLogo: job.company.logo,
        salary: salaryK,
        salaryRaw: salary,
        location: job.location || 'Remote',
        category: job.category.name,
        url: `https://freelanly.com/company/${job.company.slug}/jobs/${job.slug}`,
      };
    });

    // Generate script for video
    const scriptLines = formattedJobs.map(
      (j) => `#${j.rank}: ${j.title} at ${j.company} - ${j.salary}`
    );

    return NextResponse.json({
      success: true,
      count: formattedJobs.length,
      jobs: formattedJobs,
      // Ready-to-use content
      title: category
        ? `Top ${formattedJobs.length} ${category} Remote Jobs This Week`
        : `Top ${formattedJobs.length} Highest Paying Remote Jobs This Week`,
      script: `${formattedJobs.length} Remote jobs hiring NOW with amazing salaries!
${scriptLines.join('\n')}
All links at freelanly.com`,
    });
  } catch (error) {
    console.error('[TopJobs] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get top jobs' },
      { status: 500 }
    );
  }
}
