/**
 * Re-extract salaries and benefits from existing jobs
 * Run: DEEPSEEK_API_KEY=xxx npx tsx scripts/reextract-salaries.ts
 */

import { prisma } from '../src/lib/db';
import { extractJobData } from '../src/lib/deepseek';

const BATCH_SIZE = 10;
const DELAY_MS = 500; // Delay between requests to avoid rate limiting

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🔍 Finding jobs to re-extract...\n');

  // Find jobs that have originalContent but no salary or empty benefits
  const jobs = await prisma.job.findMany({
    where: {
      originalContent: { not: null },
      OR: [
        { salaryMin: null },
        { benefits: { isEmpty: true } }
      ]
    },
    select: {
      id: true,
      title: true,
      originalContent: true,
      salaryMin: true,
      salaryMax: true,
      benefits: true,
    },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Found ${jobs.length} jobs to process\n`);

  if (jobs.length === 0) {
    console.log('✅ All jobs already have salary/benefits data');
    return;
  }

  let updated = 0;
  let failed = 0;
  let noData = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    console.log(`[${i + 1}/${jobs.length}] Processing: ${job.title}`);

    try {
      const extracted = await extractJobData(job.originalContent!);

      if (!extracted) {
        console.log('  ⚠️  No data extracted');
        noData++;
        continue;
      }

      // Prepare update data - only update if we found new data
      const updateData: Record<string, unknown> = {};

      if (extracted.salaryMin && !job.salaryMin) {
        updateData.salaryMin = extracted.salaryMin;
        updateData.salaryMax = extracted.salaryMax || extracted.salaryMin;
        updateData.salaryCurrency = extracted.salaryCurrency || 'USD';
        updateData.salaryPeriod = extracted.salaryPeriod || 'YEAR';
      }

      if (extracted.benefits.length > 0 && job.benefits.length === 0) {
        updateData.benefits = extracted.benefits;
      }

      // Also update skills if empty
      if (extracted.skills.length > 0) {
        const existingJob = await prisma.job.findUnique({
          where: { id: job.id },
          select: { skills: true }
        });
        if (existingJob && existingJob.skills.length === 0) {
          updateData.skills = extracted.skills;
        }
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.job.update({
          where: { id: job.id },
          data: updateData
        });

        console.log('  ✅ Updated:', Object.keys(updateData).join(', '));
        if (updateData.salaryMin) {
          console.log(`     Salary: $${updateData.salaryMin} - $${updateData.salaryMax}`);
        }
        if (updateData.benefits) {
          console.log(`     Benefits: ${(updateData.benefits as string[]).join(', ')}`);
        }
        updated++;
      } else {
        console.log('  ⏭️  No new data to update');
        noData++;
      }

    } catch (error) {
      console.log('  ❌ Error:', error instanceof Error ? error.message : 'Unknown error');
      failed++;
    }

    // Delay to avoid rate limiting
    await sleep(DELAY_MS);
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Updated: ${updated}`);
  console.log(`  ⏭️  No data: ${noData}`);
  console.log(`  ❌ Failed: ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
