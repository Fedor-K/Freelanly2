import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Normalize company name for comparison
function normalizeForComparison(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/,\s*$/, '')
    .replace(/\s*[-–—]\s*engineering.*$/i, '')
    .replace(/\s*[-–—]\s*technology.*$/i, '')
    .replace(/\s*[-–—]\s*solutions.*$/i, '')
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '') // Remove punctuation
    .replace(/\s+(inc|llc|ltd|corp|corporation|company|co)\.?$/i, '') // Remove common suffixes
    .trim();
}

async function main() {
  console.log('Finding duplicate companies...');

  // Find companies with duplicate names (case-insensitive)
  const companies = await prisma.company.findMany({
    include: {
      _count: { select: { jobs: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by normalized name
  const nameGroups: Map<string, typeof companies> = new Map();
  for (const company of companies) {
    const key = normalizeForComparison(company.name);
    if (!key) continue; // Skip empty names
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
