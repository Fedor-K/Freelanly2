import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/content/salary-stats
 * Returns salary statistics by category for social content
 *
 * Query params:
 * - category: category slug (required)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get('category');

    if (!categorySlug) {
      return NextResponse.json(
        { error: 'Category parameter required' },
        { status: 400 }
      );
    }

    // Get category
    const category = await prisma.category.findUnique({
      where: { slug: categorySlug },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    // Get jobs with annual salaries for this category
    const jobs = await prisma.job.findMany({
      where: {
        categoryId: category.id,
        salaryMin: { not: null },
        salaryPeriod: 'YEAR', // Only annual for accurate comparison
      },
      select: {
        salaryMin: true,
        salaryMax: true,
        salaryCurrency: true,
        level: true,
      },
    });

    if (jobs.length === 0) {
      return NextResponse.json(
        { error: 'No salary data for this category' },
        { status: 404 }
      );
    }

    // Group by level
    const byLevel: Record<string, number[]> = {
      ENTRY: [],
      MID: [],
      SENIOR: [],
      LEAD: [],
    };

    for (const job of jobs) {
      const salary = job.salaryMax || job.salaryMin || 0;
      if (byLevel[job.level]) {
        byLevel[job.level].push(salary);
      } else if (job.level === 'INTERN') {
        byLevel.ENTRY.push(salary);
      } else if (job.level === 'EXECUTIVE') {
        byLevel.LEAD.push(salary);
      }
    }

    // Calculate stats
    const calcStats = (salaries: number[]) => {
      if (salaries.length === 0) return null;
      const sorted = salaries.sort((a, b) => a - b);
      return {
        min: Math.round(sorted[0] / 1000) * 1000,
        max: Math.round(sorted[sorted.length - 1] / 1000) * 1000,
        avg: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length / 1000) * 1000,
        count: salaries.length,
      };
    };

    const stats = {
      entry: calcStats(byLevel.ENTRY),
      mid: calcStats(byLevel.MID),
      senior: calcStats(byLevel.SENIOR),
      lead: calcStats(byLevel.LEAD),
    };

    // Format for display
    const formatRange = (s: { min: number; max: number } | null) => {
      if (!s) return null;
      const formatK = (n: number) => `$${Math.round(n / 1000)}K`;
      return `${formatK(s.min)}-${formatK(s.max)}`;
    };

    return NextResponse.json({
      success: true,
      category: category.name,
      categorySlug: category.slug,
      totalJobs: jobs.length,
      salaries: {
        entry: stats.entry ? {
          range: formatRange(stats.entry),
          avg: `$${Math.round(stats.entry.avg / 1000)}K`,
          count: stats.entry.count,
        } : null,
        mid: stats.mid ? {
          range: formatRange(stats.mid),
          avg: `$${Math.round(stats.mid.avg / 1000)}K`,
          count: stats.mid.count,
        } : null,
        senior: stats.senior ? {
          range: formatRange(stats.senior),
          avg: `$${Math.round(stats.senior.avg / 1000)}K`,
          count: stats.senior.count,
        } : null,
        lead: stats.lead ? {
          range: formatRange(stats.lead),
          avg: `$${Math.round(stats.lead.avg / 1000)}K`,
          count: stats.lead.count,
        } : null,
      },
      // Ready-to-use script for video
      script: `How much do Remote ${category.name} professionals make?
${stats.entry ? `Entry Level: ${formatRange(stats.entry)} per year` : ''}
${stats.mid ? `Mid Level: ${formatRange(stats.mid)} per year` : ''}
${stats.senior ? `Senior: ${formatRange(stats.senior)} per year` : ''}
${stats.lead ? `Lead: ${formatRange(stats.lead)} per year` : ''}
Find these jobs at freelanly.com`.trim().replace(/\n+/g, '\n'),
    });
  } catch (error) {
    console.error('[SalaryStats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get salary stats' },
      { status: 500 }
    );
  }
}
