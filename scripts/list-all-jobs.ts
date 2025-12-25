/**
 * List all jobs in the database
 *
 * Usage:
 *   dotenv -e .env.local -- npx tsx scripts/list-all-jobs.ts
 *   dotenv -e .env.local -- npx tsx scripts/list-all-jobs.ts --csv
 */

import { prisma } from '../src/lib/db';

async function main() {
  const args = process.argv.slice(2);
  const csvMode = args.includes('--csv');

  const jobs = await prisma.job.findMany({
    where: { isActive: true },
    select: {
      id: true,
      title: true,
      slug: true,
      source: true,
      postedAt: true,
      company: {
        select: {
          name: true,
          slug: true,
        },
      },
      category: {
        select: {
          slug: true,
        },
      },
    },
    orderBy: { postedAt: 'desc' },
  });

  console.log(`📊 Total active jobs: ${jobs.length}\n`);

  if (csvMode) {
    // CSV output
    console.log('company,title,category,source,posted,url');
    for (const job of jobs) {
      const url = `https://freelanly.com/company/${job.company.slug}/jobs/${job.slug}`;
      console.log(`"${job.company.name}","${job.title}","${job.category?.slug || ''}","${job.source}","${job.postedAt.toISOString().split('T')[0]}","${url}"`);
    }
  } else {
    // Stats by source
    const bySource: Record<string, number> = {};
    for (const job of jobs) {
      bySource[job.source] = (bySource[job.source] || 0) + 1;
    }
    console.log('📈 Jobs by source:');
    for (const [source, count] of Object.entries(bySource).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${source}: ${count}`);
    }

    // Stats by category
    const byCategory: Record<string, number> = {};
    for (const job of jobs) {
      const cat = job.category?.slug || 'uncategorized';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    console.log('\n📁 Jobs by category:');
    for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
      console.log(`   ${cat}: ${count}`);
    }

    // Show first 50 jobs
    console.log('\n📋 Recent jobs (first 50):');
    for (const job of jobs.slice(0, 50)) {
      console.log(`   ${job.title} @ ${job.company.name} [${job.source}]`);
    }

    if (jobs.length > 50) {
      console.log(`\n   ... and ${jobs.length - 50} more`);
      console.log(`\n   Run with --csv for full list in CSV format`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
