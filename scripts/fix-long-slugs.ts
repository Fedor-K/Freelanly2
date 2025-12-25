import { prisma } from '../src/lib/db';
import { slugify } from '../src/lib/utils';

const MAX_SLUG_LENGTH = 50;

async function fixLongSlugs() {
  console.log('Finding companies with long slugs...');

  // Find companies with slugs longer than MAX_SLUG_LENGTH
  const companies = await prisma.company.findMany({
    where: {},
    select: { id: true, name: true, slug: true },
  });

  const longSlugCompanies = companies.filter(c => c.slug.length > MAX_SLUG_LENGTH);
  console.log(`Found ${longSlugCompanies.length} companies with slugs > ${MAX_SLUG_LENGTH} chars`);

  for (const company of longSlugCompanies) {
    const newSlug = slugify(company.name, MAX_SLUG_LENGTH);

    // Check if new slug already exists
    const existing = await prisma.company.findFirst({
      where: { slug: newSlug, id: { not: company.id } },
    });

    if (existing) {
      console.log(`⚠️  Skip: ${company.slug} → ${newSlug} (already exists)`);
      continue;
    }

    await prisma.company.update({
      where: { id: company.id },
      data: { slug: newSlug },
    });

    console.log(`✅ ${company.slug} → ${newSlug}`);
  }

  // Now fix jobs
  console.log('\nFinding jobs with long slugs...');

  const jobs = await prisma.job.findMany({
    where: {},
    select: { id: true, title: true, slug: true, companyId: true },
  });

  const longSlugJobs = jobs.filter(j => j.slug.length > MAX_SLUG_LENGTH);
  console.log(`Found ${longSlugJobs.length} jobs with slugs > ${MAX_SLUG_LENGTH} chars`);

  for (const job of longSlugJobs) {
    const newSlug = slugify(job.title, MAX_SLUG_LENGTH);

    // Check if new slug already exists for this company
    const existing = await prisma.job.findFirst({
      where: {
        slug: newSlug,
        companyId: job.companyId,
        id: { not: job.id }
      },
    });

    if (existing) {
      // Add suffix to make unique
      const uniqueSlug = `${newSlug.substring(0, MAX_SLUG_LENGTH - 8)}-${job.id.substring(0, 7)}`;
      await prisma.job.update({
        where: { id: job.id },
        data: { slug: uniqueSlug },
      });
      console.log(`✅ ${job.slug} → ${uniqueSlug} (with suffix)`);
    } else {
      await prisma.job.update({
        where: { id: job.id },
        data: { slug: newSlug },
      });
      console.log(`✅ ${job.slug} → ${newSlug}`);
    }
  }

  console.log('\nDone!');
}

fixLongSlugs()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
