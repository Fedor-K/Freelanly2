/**
 * Migration: Add estimated salaries to jobs without salary data
 *
 * This fixes Google Search Console warnings about missing 'baseSalary' field.
 *
 * Run: npx tsx scripts/migrate-salary-estimates.ts
 */

import { PrismaClient } from '@prisma/client';
import { calculateEstimatedSalary } from '../src/lib/salary-estimation';

const prisma = new PrismaClient();

async function main() {
  console.log('=== MIGRATE SALARY ESTIMATES ===\n');

  // Find all jobs without salary
  const jobsWithoutSalary = await prisma.job.findMany({
    where: { salaryMin: null },
    select: {
      id: true,
      title: true,
      level: true,
      country: true,
      category: { select: { slug: true } },
    },
  });

  console.log(`Found ${jobsWithoutSalary.length} jobs without salary data\n`);

  if (jobsWithoutSalary.length === 0) {
    console.log('Nothing to migrate!');
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const job of jobsWithoutSalary) {
    try {
      const estimated = calculateEstimatedSalary(
        job.category?.slug,
        job.level,
        job.country
      );

      await prisma.job.update({
        where: { id: job.id },
        data: {
          salaryMin: estimated.salaryMin,
          salaryMax: estimated.salaryMax,
          salaryCurrency: estimated.salaryCurrency,
          salaryPeriod: estimated.salaryPeriod,
          salaryIsEstimate: true,
        },
      });

      updated++;

      if (updated % 50 === 0) {
        console.log(`Progress: ${updated}/${jobsWithoutSalary.length}`);
      }
    } catch (error) {
      console.error(`Error updating job ${job.id} (${job.title}):`, error);
      errors++;
    }
  }

  console.log('\n=== MIGRATION COMPLETE ===');
  console.log(`Updated: ${updated}`);
  console.log(`Errors: ${errors}`);

  // Verify
  const remaining = await prisma.job.count({ where: { salaryMin: null } });
  console.log(`Jobs still without salary: ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
