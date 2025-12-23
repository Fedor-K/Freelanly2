/**
 * Audit ALL jobs - full table with company data
 *
 * Usage: npx tsx scripts/audit-jobs.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  console.log('Fetching all jobs...\n');

  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      postedAt: true,
      company: {
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          website: true,
        },
      },
    },
    orderBy: { postedAt: 'desc' },
  });

  console.log(`Total jobs: ${jobs.length}\n`);
  console.log('='.repeat(180));

  // Header
  console.log(
    '#'.padEnd(4) +
    'Job Title'.padEnd(35) +
    'Company Name'.padEnd(25) +
    'Company Slug'.padEnd(25) +
    'Logo'.padEnd(8) +
    'Website'.padEnd(8) +
    'Desc'.padEnd(6) +
    'Slug Match'.padEnd(12) +
    'Issues'
  );
  console.log('='.repeat(180));

  let issueCount = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const c = job.company;

    // Checks
    const hasLogo = c.logo && c.logo.length > 0;
    const hasWebsite = c.website && c.website.length > 0;
    const hasDesc = job.description && job.description.length >= 50;
    const expectedSlug = slugify(c.name);
    const slugMatch = c.slug === expectedSlug || c.slug.startsWith(expectedSlug);

    // Collect issues
    const issues: string[] = [];
    if (!hasLogo) issues.push('NO_LOGO');
    if (!hasWebsite) issues.push('NO_SITE');
    if (!hasDesc) issues.push('NO_DESC');
    if (!slugMatch) issues.push('SLUG_BAD');

    if (issues.length > 0) issueCount++;

    // Print row
    console.log(
      String(i + 1).padEnd(4) +
      job.title.substring(0, 33).padEnd(35) +
      c.name.substring(0, 23).padEnd(25) +
      c.slug.substring(0, 23).padEnd(25) +
      (hasLogo ? '✓' : '✗').padEnd(8) +
      (hasWebsite ? '✓' : '✗').padEnd(8) +
      (hasDesc ? '✓' : '✗').padEnd(6) +
      (slugMatch ? '✓' : '✗').padEnd(12) +
      (issues.length > 0 ? issues.join(', ') : '-')
    );
  }

  console.log('='.repeat(180));
  console.log(`\nTotal: ${jobs.length} jobs, ${issueCount} with issues`);

  // Save to CSV
  const csv = [
    'Job Title,Company Name,Company Slug,Logo,Website,Description,Slug Match,Issues',
    ...jobs.map(job => {
      const c = job.company;
      const hasLogo = c.logo && c.logo.length > 0;
      const hasWebsite = c.website && c.website.length > 0;
      const hasDesc = job.description && job.description.length >= 50;
      const expectedSlug = slugify(c.name);
      const slugMatch = c.slug === expectedSlug || c.slug.startsWith(expectedSlug);
      const issues: string[] = [];
      if (!hasLogo) issues.push('NO_LOGO');
      if (!hasWebsite) issues.push('NO_SITE');
      if (!hasDesc) issues.push('NO_DESC');
      if (!slugMatch) issues.push('SLUG_BAD');

      return `"${job.title.replace(/"/g, '""')}","${c.name.replace(/"/g, '""')}","${c.slug}",${hasLogo ? 'YES' : 'NO'},${hasWebsite ? 'YES' : 'NO'},${hasDesc ? 'YES' : 'NO'},${slugMatch ? 'YES' : 'NO'},"${issues.join(', ')}"`;
    })
  ].join('\n');

  const fs = await import('fs');
  fs.writeFileSync('/tmp/job-audit.csv', csv);
  console.log('\nCSV saved to: /tmp/job-audit.csv');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
