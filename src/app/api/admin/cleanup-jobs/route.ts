import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isFreeEmail } from '@/lib/utils';
import { Source } from '@prisma/client';

// Sources that come from Apify scraping (not verified)
const APIFY_SOURCES: Source[] = [Source.LINKEDIN, Source.HACKERNEWS];

// POST - Cleanup jobs from Apify sources without corporate emails
export async function POST() {
  try {
    console.log('Starting cleanup of non-corporate email jobs from Apify sources...');

    // Find jobs from Apify sources with free email providers or no email
    const jobsToCheck = await prisma.job.findMany({
      where: {
        source: { in: APIFY_SOURCES },
      },
      select: {
        id: true,
        applyEmail: true,
        companyId: true,
        source: true,
      },
    });

    const jobIdsToDelete: string[] = [];
    const companyIdsToCheck = new Set<string>();

    for (const job of jobsToCheck) {
      // Delete if no email or free email (only for Apify sources)
      if (!job.applyEmail || isFreeEmail(job.applyEmail)) {
        jobIdsToDelete.push(job.id);
        companyIdsToCheck.add(job.companyId);
      }
    }

    console.log(`Found ${jobIdsToDelete.length} Apify jobs to delete`);

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
      note: 'Only cleaned up Apify sources (LinkedIn, HackerNews). ATS jobs preserved.',
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
    // Only check Apify sources
    const apifyJobs = await prisma.job.findMany({
      where: {
        source: { in: APIFY_SOURCES },
      },
      select: {
        id: true,
        title: true,
        applyEmail: true,
        source: true,
        company: {
          select: { name: true },
        },
      },
    });

    const jobsToDelete = apifyJobs.filter(
      job => !job.applyEmail || isFreeEmail(job.applyEmail)
    );

    const corporateApifyJobs = apifyJobs.filter(
      job => job.applyEmail && !isFreeEmail(job.applyEmail)
    );

    // Count ATS jobs (will be preserved)
    const atsJobs = await prisma.job.count({
      where: {
        source: { notIn: APIFY_SOURCES },
      },
    });

    return NextResponse.json({
      totalApifyJobs: apifyJobs.length,
      apifyJobsToDelete: jobsToDelete.length,
      apifyCorporateJobs: corporateApifyJobs.length,
      atsJobsPreserved: atsJobs,
      preview: jobsToDelete.slice(0, 20).map(j => ({
        title: j.title,
        company: j.company.name,
        source: j.source,
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
