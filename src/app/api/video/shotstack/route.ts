import { NextResponse } from 'next/server';
import {
  createJobAlertVideo,
  createSalaryRevealVideo,
  renderVideo,
  getVideoStatus,
  waitForVideo,
} from '@/services/shotstack';
import { prisma } from '@/lib/db';

/**
 * POST /api/video/shotstack
 * Generate a video using Shotstack
 *
 * Body:
 * - type: 'job-alert' | 'salary-reveal'
 * - jobId: string (for job-alert)
 * - category: string (for salary-reveal)
 * - wait: boolean (wait for completion, default false)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, jobId, category, wait = false } = body;

    let template;

    switch (type) {
      case 'job-alert': {
        if (!jobId) {
          return NextResponse.json({ error: 'jobId required for job-alert' }, { status: 400 });
        }

        const job = await prisma.job.findUnique({
          where: { id: jobId },
          include: { company: true },
        });

        if (!job) {
          return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const salary = formatSalary(job);
        template = createJobAlertVideo({
          jobTitle: job.title,
          companyName: job.company.name,
          salary,
          location: job.location || 'Remote',
          jobType: job.type.replace('_', ' '),
        });
        break;
      }

      case 'salary-reveal': {
        const categorySlug = category || 'engineering';

        const categoryData = await prisma.category.findUnique({
          where: { slug: categorySlug },
        });

        if (!categoryData) {
          return NextResponse.json({ error: 'Category not found' }, { status: 404 });
        }

        // Get salary data from jobs
        const jobs = await prisma.job.findMany({
          where: {
            categoryId: categoryData.id,
            salaryMin: { not: null },
            salaryPeriod: 'YEAR',
            salaryCurrency: 'USD',
          },
          select: { salaryMin: true, salaryMax: true, level: true },
        });

        const byLevel: Record<string, number[]> = { ENTRY: [], MID: [], SENIOR: [] };
        for (const job of jobs) {
          const salary = job.salaryMax || job.salaryMin || 0;
          if (byLevel[job.level]) byLevel[job.level].push(salary);
        }

        const getRange = (arr: number[]) => {
          if (arr.length === 0) return null;
          const min = Math.min(...arr);
          const max = Math.max(...arr);
          return `$${Math.round(min / 1000)}K - $${Math.round(max / 1000)}K`;
        };

        template = createSalaryRevealVideo({
          categoryName: categoryData.name,
          entryLevel: getRange(byLevel.ENTRY),
          midLevel: getRange(byLevel.MID),
          seniorLevel: getRange(byLevel.SENIOR),
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: 'Invalid type. Use: job-alert, salary-reveal' },
          { status: 400 }
        );
    }

    // Submit render request
    const render = await renderVideo(template);

    if (wait) {
      // Wait for completion and return URL
      const url = await waitForVideo(render.id);
      return NextResponse.json({
        success: true,
        renderId: render.id,
        status: 'done',
        url,
      });
    }

    // Return immediately with render ID
    return NextResponse.json({
      success: true,
      renderId: render.id,
      status: render.status,
      message: 'Video rendering started. Use GET /api/video/shotstack?id=<renderId> to check status.',
    });
  } catch (error) {
    console.error('[Shotstack] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate video', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/video/shotstack?id=<renderId>
 * Check video rendering status
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const renderId = searchParams.get('id');

    if (!renderId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    const status = await getVideoStatus(renderId);

    return NextResponse.json({
      renderId,
      status: status.status,
      url: status.url,
      error: status.error,
    });
  } catch (error) {
    console.error('[Shotstack] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get video status', details: String(error) },
      { status: 500 }
    );
  }
}

// Helper function to format salary
function formatSalary(job: {
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  salaryPeriod?: string | null;
}): string | null {
  if (!job.salaryMin && !job.salaryMax) return null;

  const currency = job.salaryCurrency || 'USD';
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', CAD: 'C$', AUD: 'A$',
  };
  const symbol = symbols[currency] || currency + ' ';

  const min = job.salaryMin ? Math.round(job.salaryMin / 1000) : null;
  const max = job.salaryMax ? Math.round(job.salaryMax / 1000) : null;

  if (min && max && min !== max) {
    return `${symbol}${min}K - ${symbol}${max}K/year`;
  }
  return `${symbol}${max || min}K/year`;
}
