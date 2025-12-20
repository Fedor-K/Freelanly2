import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Finding duplicate jobs...');

  // Find all jobs grouped by company + title (case-insensitive)
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      companyId: true,
      createdAt: true,
      sourceId: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by company + normalized title
  const jobGroups: Map<string, typeof jobs> = new Map();

  for (const job of jobs) {
    const key = `${job.companyId}:${job.title.toLowerCase().trim()}`;
    const existing = jobGroups.get(key) || [];
    existing.push(job);
    jobGroups.set(key, existing);
  }

  // Find and remove duplicates
  let totalDuplicates = 0;

  for (const [key, group] of jobGroups) {
    if (group.length > 1) {
      // Keep the oldest one
      const sorted = group.sort((a, b) => {
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      const keep = sorted[0];
      const toDelete = sorted.slice(1);

      console.log(`\nDuplicate: "${keep.title}" (${group.length} copies)`);
      console.log(`  Keeping: ${keep.id}`);

      for (const dup of toDelete) {
        console.log(`  Deleting: ${dup.id}`);
        await prisma.job.delete({ where: { id: dup.id } });
        totalDuplicates++;
      }
    }
  }

  console.log(`\n✅ Done! Removed ${totalDuplicates} duplicate jobs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
