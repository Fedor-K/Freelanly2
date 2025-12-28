import { prisma } from '@/lib/db';

/**
 * Cleanup old/inactive jobs that are no longer shown on the site
 * Jobs older than 30 days or inactive are deleted
 */
export async function cleanupOldJobs(): Promise<{ deleted: number }> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deleted = await prisma.job.deleteMany({
    where: {
      OR: [
        { isActive: false },
        { postedAt: { lt: thirtyDaysAgo } }
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
