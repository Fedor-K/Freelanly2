/**
 * Reformat job titles to SEO-optimized format
 *
 * Run with: npx tsx scripts/reformat-job-titles.ts
 */

import { prisma } from '../src/lib/db';
import { extractJobData } from '../src/lib/deepseek';
import { slugify } from '../src/lib/utils';

async function main() {
  console.log('=== Reformatting job titles ===\n');

  // Find all LinkedIn jobs with original content
  const jobs = await prisma.job.findMany({
    where: {
      source: 'LINKEDIN',
      originalContent: { not: null },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      originalContent: true,
      level: true,
      sourceLanguages: true,
      targetLanguages: true,
      company: { select: { slug: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200, // Process in batches
  });

  console.log(`Found ${jobs.length} LinkedIn jobs to process\n`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    if (!job.originalContent) {
      skipped++;
      continue;
    }

    console.log(`\nProcessing: "${job.title}"`);

    try {
      const extracted = await extractJobData(job.originalContent);

      if (!extracted || !extracted.title) {
        console.log(`  -> SKIP: DeepSeek returned no title`);
        skipped++;
        continue;
      }

      const newTitle = extracted.title;

      // Check if title changed significantly
      if (newTitle.toLowerCase() === job.title.toLowerCase()) {
        console.log(`  -> SKIP: Title unchanged`);
        skipped++;
        continue;
      }

      // Generate new slug
      const baseSlug = slugify(`${newTitle}-${job.company.slug}`);
      let newSlug = baseSlug;

      // Check if new slug already exists (avoid collision)
      const existingWithSlug = await prisma.job.findFirst({
        where: { slug: newSlug, id: { not: job.id } },
      });

      if (existingWithSlug) {
        // Keep old slug to avoid URL breaks
        newSlug = job.slug;
        console.log(`  -> Keeping old slug (collision)`);
      }

      // Update job
      const updateData: any = {
        title: newTitle,
      };

      // Only update slug if it's a new job (created recently)
      if (!existingWithSlug && newSlug !== job.slug) {
        updateData.slug = newSlug;
      }

      // Update level if extracted and different
      if (extracted.level && extracted.level !== job.level) {
        updateData.level = extracted.level;
        console.log(`  -> Level: ${job.level} → ${extracted.level}`);
      }

      // Update languages if not already set
      if (job.sourceLanguages.length === 0 && extracted.sourceLanguages?.length > 0) {
        updateData.sourceLanguages = extracted.sourceLanguages;
        updateData.targetLanguages = extracted.targetLanguages || [];
        console.log(`  -> Languages: ${extracted.sourceLanguages.join(',')} → ${(extracted.targetLanguages || []).join(',')}`);
      }

      await prisma.job.update({
        where: { id: job.id },
        data: updateData,
      });

      console.log(`  -> UPDATED: "${job.title}" → "${newTitle}"`);
      updated++;

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`  -> ERROR:`, error);
      failed++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total: ${jobs.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
