import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Jobs by source (all time)
  const jobsBySource = await prisma.job.groupBy({
    by: ['source'],
    _count: true,
    orderBy: { _count: { source: 'desc' } }
  });

  console.log('=== JOBS BY SOURCE (ALL TIME) ===');
  jobsBySource.forEach(s => console.log(`${s.source}: ${s._count}`));

  // Jobs in last 7 days by source
  const last7Days = await prisma.job.groupBy({
    by: ['source'],
    where: { postedAt: { gte: sevenDaysAgo } },
    _count: true,
    orderBy: { _count: { source: 'desc' } }
  });

  console.log('\n=== LAST 7 DAYS ===');
  last7Days.forEach(s => console.log(`${s.source}: ${s._count}`));

  // Jobs in last 30 days by source
  const last30Days = await prisma.job.groupBy({
    by: ['source'],
    where: { postedAt: { gte: thirtyDaysAgo } },
    _count: true,
    orderBy: { _count: { source: 'desc' } }
  });

  console.log('\n=== LAST 30 DAYS ===');
  last30Days.forEach(s => console.log(`${s.source}: ${s._count}`));

  // Active Lever sources with job counts
  const leverSources = await prisma.source.findMany({
    where: { isActive: true, type: 'LEVER' },
    select: {
      id: true,
      name: true,
      lastFetchedAt: true,
      _count: { select: { jobs: true } }
    },
    orderBy: { name: 'asc' }
  });

  console.log('\n=== LEVER SOURCES (Active) ===');
  const zeroJobLever: string[] = [];
  leverSources.forEach(s => {
    const lastFetch = s.lastFetchedAt ? s.lastFetchedAt.toISOString().split('T')[0] : 'never';
    if (s._count.jobs === 0) {
      zeroJobLever.push(s.name);
    }
    console.log(`${s.name}: ${s._count.jobs} jobs (last: ${lastFetch})`);
  });

  if (zeroJobLever.length > 0) {
    console.log('\n🚨 LEVER SOURCES WITH 0 JOBS:');
    zeroJobLever.forEach(name => console.log(`  - ${name}`));
  }

  // Opportunities by source
  const oppsBySource = await prisma.opportunity.groupBy({
    by: ['source'],
    _count: true,
    orderBy: { _count: { source: 'desc' } }
  });

  console.log('\n=== OPPORTUNITIES BY SOURCE ===');
  oppsBySource.forEach(s => console.log(`${s.source}: ${s._count}`));

  await prisma.$disconnect();
}

main().catch(console.error);
