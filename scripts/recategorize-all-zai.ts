/**
 * Recategorize all jobs using Z.ai
 * Compares with current categories and updates if different
 */

import { PrismaClient } from '@prisma/client';
import { classifyJobCategory } from '../src/lib/deepseek';

const prisma = new PrismaClient();

interface CategoryChange {
  jobId: string;
  title: string;
  oldCategory: string;
  newCategory: string;
}

async function main() {
  console.log('🔄 Recategorizing all jobs with Z.ai\n');
  console.log('AI_PROVIDER:', process.env.AI_PROVIDER || 'deepseek (default)');
  console.log('='.repeat(60));

  // Get all categories
  const categories = await prisma.category.findMany();
  const catById = new Map(categories.map(c => [c.id, c]));
  const catBySlug = new Map(categories.map(c => [c.slug, c]));

  // Get all jobs
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      skills: true,
      categoryId: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`\nProcessing ${jobs.length} jobs...\n`);

  const changes: CategoryChange[] = [];
  let processed = 0;
  let errors = 0;
  const startTime = Date.now();

  for (const job of jobs) {
    processed++;
    const cleanTitle = job.title.replace(/^\[.*?\]\s*/, '').replace(/^-\s*/, '').trim();

    try {
      // Get new category from AI
      const newCategorySlug = await classifyJobCategory(cleanTitle, job.skills);
      const newCategory = catBySlug.get(newCategorySlug);

      if (!newCategory) {
        console.log(`⚠️  Unknown category "${newCategorySlug}" for: ${cleanTitle}`);
        continue;
      }

      const oldCategory = catById.get(job.categoryId);
      const oldSlug = oldCategory?.slug || 'unknown';

      if (newCategorySlug !== oldSlug) {
        changes.push({
          jobId: job.id,
          title: cleanTitle,
          oldCategory: oldSlug,
          newCategory: newCategorySlug,
        });

        // Update in DB
        await prisma.job.update({
          where: { id: job.id },
          data: { categoryId: newCategory.id },
        });

        console.log(`[${processed}/${jobs.length}] ✏️  ${cleanTitle}`);
        console.log(`         ${oldSlug} → ${newCategorySlug}`);
      } else {
        if (processed % 50 === 0) {
          console.log(`[${processed}/${jobs.length}] ✓ Processing...`);
        }
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      errors++;
      console.error(`[${processed}/${jobs.length}] ❌ Error: ${cleanTitle}`, error);
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY\n');
  console.log(`Total jobs: ${jobs.length}`);
  console.log(`Changed: ${changes.length}`);
  console.log(`Errors: ${errors}`);
  console.log(`Time: ${elapsed.toFixed(1)}s`);

  if (changes.length > 0) {
    console.log('\n📝 Changes made:');

    // Group by change type
    const changesByType = new Map<string, number>();
    for (const c of changes) {
      const key = `${c.oldCategory} → ${c.newCategory}`;
      changesByType.set(key, (changesByType.get(key) || 0) + 1);
    }

    // Sort by count
    const sorted = [...changesByType.entries()].sort((a, b) => b[1] - a[1]);
    for (const [change, count] of sorted) {
      console.log(`   ${change}: ${count}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
