import { PrismaClient } from '@prisma/client';
import { normalizeTranslationTitle } from '../src/lib/deepseek';

const prisma = new PrismaClient();

async function main() {
  console.log('Finding translation jobs to normalize...\n');

  // Find all jobs in translation category
  const translationCategory = await prisma.category.findFirst({
    where: { slug: 'translation' }
  });

  if (!translationCategory) {
    console.log('Translation category not found');
    return;
  }

  const jobs = await prisma.job.findMany({
    where: { categoryId: translationCategory.id },
    select: { id: true, title: true }
  });

  console.log(`Found ${jobs.length} translation jobs\n`);

  let updated = 0;
  let skipped = 0;

  for (const job of jobs) {
    const normalizedTitle = normalizeTranslationTitle(job.title);

    if (normalizedTitle !== job.title) {
      console.log(`"${job.title}" → "${normalizedTitle}"`);

      await prisma.job.update({
        where: { id: job.id },
        data: { title: normalizedTitle }
      });

      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`\n✅ Done!`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (already correct): ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
