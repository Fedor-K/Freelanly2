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
