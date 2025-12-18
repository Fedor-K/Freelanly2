import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMaxJobAgeDate, MAX_JOB_AGE_DAYS } from '@/lib/utils';

// POST /api/admin/cleanup-jobs - Deactivate jobs older than MAX_JOB_AGE_DAYS
export async function POST() {
  try {
    const maxAgeDate = getMaxJobAgeDate();

    // Deactivate old jobs
    const result = await prisma.job.updateMany({
      where: {
        isActive: true,
        postedAt: { lt: maxAgeDate },
      },
      data: {
        isActive: false,
      },
    });

    // Log the cleanup
    console.log(`[Cleanup] Deactivated ${result.count} jobs older than ${MAX_JOB_AGE_DAYS} days`);

    return NextResponse.json({
      success: true,
      deactivated: result.count,
      maxAgeDays: MAX_JOB_AGE_DAYS,
      cutoffDate: maxAgeDate.toISOString(),
    });
  } catch (error) {
    console.error('Failed to cleanup old jobs:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup old jobs' },
      { status: 500 }
    );
  }
}

// GET /api/admin/cleanup-jobs - Preview old jobs that would be deactivated
export async function GET() {
  try {
    const maxAgeDate = getMaxJobAgeDate();

    const [oldJobsCount, oldJobs] = await Promise.all([
      prisma.job.count({
        where: {
          isActive: true,
          postedAt: { lt: maxAgeDate },
        },
      }),
      prisma.job.findMany({
        where: {
          isActive: true,
          postedAt: { lt: maxAgeDate },
        },
        select: {
          id: true,
          title: true,
          postedAt: true,
          company: { select: { name: true } },
        },
        orderBy: { postedAt: 'asc' },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      count: oldJobsCount,
      maxAgeDays: MAX_JOB_AGE_DAYS,
      cutoffDate: maxAgeDate.toISOString(),
      preview: oldJobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company.name,
        postedAt: job.postedAt,
        ageInDays: Math.floor((Date.now() - job.postedAt.getTime()) / (1000 * 60 * 60 * 24)),
      })),
    });
  } catch (error) {
    console.error('Failed to get old jobs:', error);
    return NextResponse.json(
      { error: 'Failed to get old jobs' },
      { status: 500 }
    );
  }
}
