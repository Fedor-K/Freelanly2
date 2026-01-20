import { config } from 'dotenv';
config({ path: '.env.local' });

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Get ALL keyword performance, sorted by opportunities created (ASC = worst first)
  const keywordSummary = await prisma.keywordRun.groupBy({
    by: ['keyword'],
    _sum: {
      postsReceived: true,
      postsProcessed: true,
      opportunitiesCreated: true,
    },
    _count: true,
    orderBy: {
      _sum: {
        opportunitiesCreated: 'asc', // Worst first
      },
    },
  });

  console.log('=== KEYWORD PERFORMANCE (WORST FIRST) ===\n');
  console.log('Keyword | Runs | Received | Processed | Created | Conv%');
  console.log('--------|------|----------|-----------|---------|------');

  const outsiders: string[] = [];
  const lowPerformers: string[] = [];

  keywordSummary.forEach((kw) => {
    const received = kw._sum.postsReceived || 0;
    const processed = kw._sum.postsProcessed || 0;
    const created = kw._sum.opportunitiesCreated || 0;
    const convRate = received > 0 ? ((created / received) * 100).toFixed(1) : '0.0';

    const status = created === 0 ? '🚨' : created < 5 ? '⚠️' : '✅';

    console.log(`${status} ${kw.keyword.padEnd(30)} | ${String(kw._count).padStart(4)} | ${String(received).padStart(8)} | ${String(processed).padStart(9)} | ${String(created).padStart(7)} | ${convRate}%`);

    if (created === 0 && kw._count >= 3) {
      outsiders.push(kw.keyword);
    } else if (created < 3 && kw._count >= 5) {
      lowPerformers.push(kw.keyword);
    }
  });

  // Summary
  const totalKeywords = keywordSummary.length;
  const totalCreated = keywordSummary.reduce((sum, kw) => sum + (kw._sum.opportunitiesCreated || 0), 0);
  const totalReceived = keywordSummary.reduce((sum, kw) => sum + (kw._sum.postsReceived || 0), 0);

  console.log('\n=== SUMMARY ===');
  console.log(`Total keywords: ${totalKeywords}`);
  console.log(`Total posts received: ${totalReceived}`);
  console.log(`Total opportunities created: ${totalCreated}`);
  console.log(`Overall conversion: ${totalReceived > 0 ? ((totalCreated / totalReceived) * 100).toFixed(2) : 0}%`);

  if (outsiders.length > 0) {
    console.log('\n🚨 OUTSIDERS (0 opportunities, 3+ runs):');
    outsiders.forEach(k => console.log(`  - ${k}`));
  }

  if (lowPerformers.length > 0) {
    console.log('\n⚠️ LOW PERFORMERS (<3 opportunities, 5+ runs):');
    lowPerformers.forEach(k => console.log(`  - ${k}`));
  }

  await prisma.$disconnect();
}

main().catch(console.error);
