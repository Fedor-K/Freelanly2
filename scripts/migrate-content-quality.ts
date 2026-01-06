/**
 * Migration Script: Assess Content Quality for Existing Jobs
 *
 * This script evaluates all existing jobs and sets their contentQuality field
 * based on the content quality assessment algorithm.
 *
 * Run with: npx tsx scripts/migrate-content-quality.ts
 */

import { PrismaClient } from '@prisma/client';
import {
  assessContentQuality,
  isFreeEmailProvider,
  isPersonalAnnouncement,
} from '../src/lib/content-quality';

const prisma = new PrismaClient();

async function migrateContentQuality() {
  console.log('Starting content quality migration...\n');

  // Fetch all jobs
  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      description: true,
      cleanDescription: true,
      salaryMin: true,
      skills: true,
      requirementBullets: true,
      benefitBullets: true,
      applyEmail: true,
      applyUrl: true,
      contentQuality: true,
      company: {
        select: {
          apolloEnrichedAt: true, // null = not enriched, non-null = enriched
        },
      },
    },
  });

  console.log(`Found ${jobs.length} jobs to process\n`);

  const stats = {
    THIN: 0,
    LIGHT: 0,
    RICH: 0,
    updated: 0,
    unchanged: 0,
  };

  // Process in batches
  const batchSize = 100;
  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (job) => {
        // Calculate quality
        const isFreeEmail = isFreeEmailProvider(job.applyEmail);
        const isAnnouncement = isPersonalAnnouncement(job.title, job.description || '');

        const result = assessContentQuality({
          description: job.description || '',
          cleanDescription: job.cleanDescription,
          salaryMin: job.salaryMin,
          skills: job.skills,
          requirementBullets: job.requirementBullets,
          benefitBullets: job.benefitBullets,
          applyEmail: job.applyEmail,
          applyUrl: job.applyUrl,
          isFreeEmail,
          isAnnouncement,
          apolloValidated: job.company.apolloEnrichedAt !== null,
        });

        stats[result.quality]++;

        // Only update if quality changed
        if (job.contentQuality !== result.quality) {
          await prisma.job.update({
            where: { id: job.id },
            data: { contentQuality: result.quality },
          });
          stats.updated++;
        } else {
          stats.unchanged++;
        }
      })
    );

    console.log(`Processed ${Math.min(i + batchSize, jobs.length)}/${jobs.length} jobs...`);
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Total jobs: ${jobs.length}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Unchanged: ${stats.unchanged}`);
  console.log('\nQuality Distribution:');
  console.log(`  RICH: ${stats.RICH} (${((stats.RICH / jobs.length) * 100).toFixed(1)}%)`);
  console.log(`  LIGHT: ${stats.LIGHT} (${((stats.LIGHT / jobs.length) * 100).toFixed(1)}%)`);
  console.log(`  THIN: ${stats.THIN} (${((stats.THIN / jobs.length) * 100).toFixed(1)}%)`);
}

migrateContentQuality()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
