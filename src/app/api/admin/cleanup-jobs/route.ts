import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isFreeEmail } from '@/lib/utils';

// POST - Cleanup jobs and companies without corporate emails
export async function POST() {
  try {
    console.log('Starting cleanup of non-corporate email jobs...');

    // Find all jobs with free email providers or no email
    const jobsToCheck = await prisma.job.findMany({
      select: {
        id: true,
        applyEmail: true,
        companyId: true,
      },
    });

    const jobIdsToDelete: string[] = [];
    const companyIdsToCheck = new Set<string>();

    for (const job of jobsToCheck) {
      // Delete if no email or free email
      if (!job.applyEmail || isFreeEmail(job.applyEmail)) {
        jobIdsToDelete.push(job.id);
        companyIdsToCheck.add(job.companyId);
      }
    }

    console.log(`Found ${jobIdsToDelete.length} jobs to delete`);

    // Delete jobs
    const deletedJobs = await prisma.job.deleteMany({
      where: {
        id: { in: jobIdsToDelete },
      },
    });

    console.log(`Deleted ${deletedJobs.count} jobs`);

    // Find companies with no remaining jobs
    const companiesToDelete: string[] = [];

    for (const companyId of companyIdsToCheck) {
      const remainingJobs = await prisma.job.count({
        where: { companyId },
      });

      if (remainingJobs === 0) {
        companiesToDelete.push(companyId);
      }
    }

    console.log(`Found ${companiesToDelete.length} companies to delete`);

    // Delete empty companies
    const deletedCompanies = await prisma.company.deleteMany({
      where: {
        id: { in: companiesToDelete },
      },
    });

    console.log(`Deleted ${deletedCompanies.count} companies`);

    return NextResponse.json({
      success: true,
      deletedJobs: deletedJobs.count,
      deletedCompanies: deletedCompanies.count,
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup', details: String(error) },
      { status: 500 }
    );
  }
}

// GET - Preview what would be deleted
export async function GET() {
  try {
    const jobs = await prisma.job.findMany({
      select: {
        id: true,
        title: true,
        applyEmail: true,
        company: {
          select: { name: true },
        },
      },
    });

    const jobsToDelete = jobs.filter(
      job => !job.applyEmail || isFreeEmail(job.applyEmail)
    );

    const corporateJobs = jobs.filter(
      job => job.applyEmail && !isFreeEmail(job.applyEmail)
    );

    return NextResponse.json({
      totalJobs: jobs.length,
      jobsToDelete: jobsToDelete.length,
      corporateJobs: corporateJobs.length,
      preview: jobsToDelete.slice(0, 20).map(j => ({
        title: j.title,
        company: j.company.name,
        email: j.applyEmail || 'NO EMAIL',
      })),
    });
  } catch (error) {
    console.error('Error getting preview:', error);
    return NextResponse.json(
      { error: 'Failed to get preview' },
      { status: 500 }
    );
  }
}
