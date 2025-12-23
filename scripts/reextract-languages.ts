/**
 * Re-extract languages from existing translation jobs
 *
 * Run with: npx tsx scripts/reextract-languages.ts
 */

import { prisma } from '../src/lib/db';
import { extractJobData } from '../src/lib/deepseek';

async function main() {
  console.log('=== Re-extracting languages from translation jobs ===\n');

  // Find jobs that might be translation-related (by category OR by title)
  const jobs = await prisma.job.findMany({
    where: {
      OR: [
        { category: { slug: 'translation' } },
        { title: { contains: 'translator', mode: 'insensitive' } },
        { title: { contains: 'interpreter', mode: 'insensitive' } },
        { title: { contains: 'localization', mode: 'insensitive' } },
      ],
      sourceLanguages: { isEmpty: true },
      originalContent: { not: null },
    },
    select: {
      id: true,
      title: true,
      originalContent: true,
      category: { select: { slug: true } },
    },
    take: 100, // Process in batches
  });

  console.log(`Found ${jobs.length} translation-related jobs without languages\n`);

  let updated = 0;
  let failed = 0;

  for (const job of jobs) {
    if (!job.originalContent) {
      console.log(`[SKIP] ${job.title} - no original content`);
      continue;
    }

    console.log(`Processing: ${job.title} (category: ${job.category?.slug || 'none'})`);

    try {
      const extracted = await extractJobData(job.originalContent);

      if (!extracted) {
        console.log(`  -> DeepSeek extraction failed`);
        failed++;
        continue;
      }

      const sourceLanguages = extracted.sourceLanguages || [];
      const targetLanguages = extracted.targetLanguages || [];
      const translationTypes = extracted.translationTypes || [];

      if (sourceLanguages.length === 0 && targetLanguages.length === 0) {
        console.log(`  -> No languages found in content`);
        failed++;
        continue;
      }

      await prisma.job.update({
        where: { id: job.id },
        data: {
          sourceLanguages,
          targetLanguages,
          translationTypes,
        },
      });

      console.log(`  -> Updated: source=${sourceLanguages.join(',')} target=${targetLanguages.join(',')}`);
      updated++;

      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  -> Error:`, error);
      failed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total processed: ${jobs.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Failed/Skipped: ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
