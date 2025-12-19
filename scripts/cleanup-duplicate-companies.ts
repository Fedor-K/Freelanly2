import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Finding duplicate companies...');

  // Find companies with duplicate names (case-insensitive)
  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { jobs: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by lowercase name
  const nameGroups: Map<string, typeof companies> = new Map();
  for (const company of companies) {
    const key = company.name.toLowerCase();
    const existing = nameGroups.get(key) || [];
    existing.push(company);
    nameGroups.set(key, existing);
  }

  // Find duplicates
  let totalDuplicates = 0;
  let totalMerged = 0;

  for (const [name, group] of nameGroups) {
    if (group.length > 1) {
      console.log(`\nDuplicate found: "${group[0].name}" (${group.length} entries)`);

      // Keep the one with most jobs, or the oldest if tied
      const sorted = group.sort((a, b) => {
        if (b._count.jobs !== a._count.jobs) {
          return b._count.jobs - a._count.jobs;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      const keep = sorted[0];
      const toDelete = sorted.slice(1);

      console.log(`  Keeping: ${keep.slug} (${keep._count.jobs} jobs)`);

      for (const dup of toDelete) {
        console.log(`  Merging: ${dup.slug} (${dup._count.jobs} jobs) -> ${keep.slug}`);

        // Move jobs to the company we're keeping
        const updatedJobs = await prisma.job.updateMany({
          where: { companyId: dup.id },
          data: { companyId: keep.id },
        });

        console.log(`    Moved ${updatedJobs.count} jobs`);
        totalMerged += updatedJobs.count;

        // Delete duplicate company
        await prisma.company.delete({ where: { id: dup.id } });
        console.log(`    Deleted company: ${dup.slug}`);
        totalDuplicates++;
      }
    }
  }

  console.log(`\n✅ Done! Removed ${totalDuplicates} duplicate companies, merged ${totalMerged} jobs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
