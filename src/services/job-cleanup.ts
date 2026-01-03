import { prisma } from '@/lib/db';
import { getMaxJobAgeDate } from '@/lib/utils';

/**
 * Cleanup orphaned companies (companies with no jobs)
 * Should run after job cleanup to remove companies whose jobs were deleted
 */
export async function cleanupOrphanedCompanies(): Promise<{ deleted: number }> {
  const orphanedCompanies = await prisma.company.findMany({
    where: {
      jobs: { none: {} }
    },
    select: { id: true }
  });

  if (orphanedCompanies.length === 0) {
    return { deleted: 0 };
  }

  const deleted = await prisma.company.deleteMany({
    where: {
      id: { in: orphanedCompanies.map(c => c.id) }
    }
  });

  if (deleted.count > 0) {
    console.log(`🗑️ Cleaned up ${deleted.count} orphaned companies (no jobs)`);
  }

  return { deleted: deleted.count };
}

/**
 * Cleanup old/inactive jobs that are no longer shown on the site
 * Jobs older than MAX_JOB_AGE_DAYS (14 days) or inactive are deleted
 */
export async function cleanupOldJobs(): Promise<{ deleted: number }> {
  const maxAgeDate = getMaxJobAgeDate();

  const deleted = await prisma.job.deleteMany({
    where: {
      OR: [
        { isActive: false },
        { postedAt: { lt: maxAgeDate } }
      ]
    }
  });

  if (deleted.count > 0) {
    console.log(`🗑️ Cleaned up ${deleted.count} old/inactive jobs`);
  }

  return { deleted: deleted.count };
}

/**
 * Cleanup old parsing logs (FilteredJob, ImportedJob, ImportLog)
 * Data older than 20 days is deleted
 */
export async function cleanupOldParsingLogs(): Promise<{
  filteredJobs: number;
  importedJobs: number;
  importLogs: number;
}> {
  const twentyDaysAgo = new Date();
  twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);

  // Delete old FilteredJob records
  const filteredJobs = await prisma.filteredJob.deleteMany({
    where: { createdAt: { lt: twentyDaysAgo } },
  });

  // Delete old ImportedJob records
  const importedJobs = await prisma.importedJob.deleteMany({
    where: { createdAt: { lt: twentyDaysAgo } },
  });

  // Delete old ImportLog records (cascade will delete related FilteredJob/ImportedJob if any left)
  const importLogs = await prisma.importLog.deleteMany({
    where: { startedAt: { lt: twentyDaysAgo } },
  });

  const total = filteredJobs.count + importedJobs.count + importLogs.count;
  if (total > 0) {
    console.log(
      `🗑️ Cleaned up parsing logs: ${filteredJobs.count} filtered, ${importedJobs.count} imported, ${importLogs.count} import logs`
    );
  }

  return {
    filteredJobs: filteredJobs.count,
    importedJobs: importedJobs.count,
    importLogs: importLogs.count,
  };
}
