/**
 * List all jobs that fail whitelist filter
 */

import { prisma } from '../src/lib/db';
import { shouldImportByProfession, isBlacklistedProfession } from '../src/config/target-professions';

async function main() {
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      locationType: true,
      source: true,
      company: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { company: { name: 'asc' } },
      { title: 'asc' },
    ],
  });

  const failed: { id: string; title: string; company: string; reason: string; locationType: string }[] = [];

  for (const job of jobs) {
    if (!shouldImportByProfession(job.title)) {
      const reason = isBlacklistedProfession(job.title) ? 'BLACKLIST' : 'NOT_IN_WHITELIST';
      failed.push({
        id: job.id,
        title: job.title,
        company: job.company?.name || 'Unknown',
        reason,
        locationType: job.locationType || 'UNKNOWN',
      });
    }
  }

  console.log(`\n=== 284 ВАКАНСИЙ ДЛЯ УДАЛЕНИЯ ===\n`);
  console.log(`№ | Company | Title | Location | Reason`);
  console.log(`---|---------|-------|----------|-------`);

  let i = 1;
  for (const job of failed) {
    console.log(`${i}. | ${job.company} | ${job.title} | ${job.locationType} | ${job.reason}`);
    i++;
  }

  console.log(`\n--- ИТОГО: ${failed.length} вакансий ---`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
