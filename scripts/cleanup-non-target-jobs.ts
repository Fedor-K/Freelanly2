import { prisma } from '../src/lib/db';
import { isNonTargetJob, isPhysicalLocation } from '../src/lib/job-filter';

async function main() {
  console.log('Finding non-target jobs to delete...\n');

  // Get all active jobs
  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      location: true,
      locationType: true,
      company: { select: { name: true } },
    },
  });

  console.log(`Total active jobs: ${jobs.length}\n`);

  const toDelete: { id: string; title: string; company: string; reason: string }[] = [];

  for (const job of jobs) {
    // Check title
    if (isNonTargetJob(job.title)) {
      toDelete.push({
        id: job.id,
        title: job.title,
        company: job.company.name,
        reason: 'non-target title',
      });
      continue;
    }

    // Check location
    if (job.location && isPhysicalLocation(job.location)) {
      toDelete.push({
        id: job.id,
        title: job.title,
        company: job.company.name,
        reason: `physical location: ${job.location}`,
      });
      continue;
    }
  }

  console.log(`Jobs to delete: ${toDelete.length}\n`);

  // Group by reason
  const byReason = toDelete.reduce((acc, job) => {
    const key = job.reason.startsWith('physical location') ? 'physical location' : job.reason;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('By reason:');
  for (const [reason, count] of Object.entries(byReason)) {
    console.log(`  ${reason}: ${count}`);
  }
  console.log('');

  // Show samples
  console.log('Sample jobs to delete:');
  for (const job of toDelete.slice(0, 20)) {
    console.log(`  - "${job.title}" at ${job.company} (${job.reason})`);
  }
  if (toDelete.length > 20) {
    console.log(`  ... and ${toDelete.length - 20} more`);
  }
  console.log('');

  // Delete jobs
  if (toDelete.length > 0) {
    const ids = toDelete.map((j) => j.id);

    // First delete related records
    console.log('Deleting related records...');

    try {
      await prisma.alertNotification.deleteMany({
        where: { jobId: { in: ids } },
      });
    } catch (e) {
      console.log('  AlertNotification cleanup skipped');
    }

    try {
      await prisma.savedJob.deleteMany({
        where: { jobId: { in: ids } },
      });
    } catch (e) {
      console.log('  SavedJob cleanup skipped');
    }

    try {
      // @ts-ignore - model may not be generated
      await prisma.applyAttempt?.deleteMany?.({
        where: { jobId: { in: ids } },
      });
    } catch (e) {
      console.log('  ApplyAttempt cleanup skipped');
    }

    try {
      await prisma.socialPostQueue.deleteMany({
        where: { jobId: { in: ids } },
      });
    } catch (e) {
      console.log('  SocialPostQueue cleanup skipped');
    }

    // Delete jobs
    const result = await prisma.job.deleteMany({
      where: { id: { in: ids } },
    });

    console.log(`\nDeleted ${result.count} jobs.`);
  } else {
    console.log('No jobs to delete.');
  }

  // Count remaining
  const remaining = await prisma.job.count({ where: { isActive: true } });
  console.log(`\nRemaining active jobs: ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
