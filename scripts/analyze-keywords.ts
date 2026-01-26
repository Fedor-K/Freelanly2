#!/usr/bin/env npx tsx
/**
 * Keyword Effectiveness Analysis
 *
 * Analyzes all keywords by:
 * - Total opportunities created
 * - Conversion rate (posts → opportunities)
 * - Posts received vs processed
 * - Identifies best/worst performers
 *
 * Usage: npx tsx scripts/analyze-keywords.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface KeywordStats {
  keyword: string;
  runs: number;
  postsReceived: number;
  postsProcessed: number;
  opportunitiesCreated: number;
  conversionRate: number;
  validationRate: number;
  avgPostsPerRun: number;
  avgOppsPerRun: number;
}

async function analyze() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║              KEYWORD EFFECTIVENESS ANALYSIS                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

  // Get all keyword stats
  const keywordStats = await prisma.keywordRun.groupBy({
    by: ['keyword'],
    _sum: {
      postsReceived: true,
      postsProcessed: true,
      opportunitiesCreated: true,
    },
    _count: true,
  });

  // Process stats
  const stats: KeywordStats[] = keywordStats.map((kw) => {
    const postsReceived = kw._sum.postsReceived || 0;
    const postsProcessed = kw._sum.postsProcessed || 0;
    const opportunitiesCreated = kw._sum.opportunitiesCreated || 0;
    const runs = kw._count;

    return {
      keyword: kw.keyword,
      runs,
      postsReceived,
      postsProcessed,
      opportunitiesCreated,
      conversionRate: postsReceived > 0 ? (opportunitiesCreated / postsReceived) * 100 : 0,
      validationRate: postsReceived > 0 ? (postsProcessed / postsReceived) * 100 : 0,
      avgPostsPerRun: runs > 0 ? postsReceived / runs : 0,
      avgOppsPerRun: runs > 0 ? opportunitiesCreated / runs : 0,
    };
  });

  // Calculate totals
  const totals = stats.reduce(
    (acc, s) => ({
      runs: acc.runs + s.runs,
      postsReceived: acc.postsReceived + s.postsReceived,
      postsProcessed: acc.postsProcessed + s.postsProcessed,
      opportunitiesCreated: acc.opportunitiesCreated + s.opportunitiesCreated,
    }),
    { runs: 0, postsReceived: 0, postsProcessed: 0, opportunitiesCreated: 0 }
  );

  const overallConversion = totals.postsReceived > 0
    ? (totals.opportunitiesCreated / totals.postsReceived) * 100
    : 0;

  // === SUMMARY ===
  console.log('═══ ОБЩАЯ СТАТИСТИКА ═══\n');
  console.log(`  Всего ключевиков:      ${stats.length}`);
  console.log(`  Всего запусков:        ${totals.runs}`);
  console.log(`  Постов получено:       ${totals.postsReceived}`);
  console.log(`  Прошли валидацию:      ${totals.postsProcessed} (${((totals.postsProcessed / totals.postsReceived) * 100).toFixed(1)}%)`);
  console.log(`  Opportunities создано: ${totals.opportunitiesCreated}`);
  console.log(`  Общая конверсия:       ${overallConversion.toFixed(1)}%`);

  // === TOP PERFORMERS BY OPPORTUNITIES ===
  console.log('\n═══ ТОП-20 ПО КОЛИЧЕСТВУ OPPORTUNITIES ═══\n');
  const byOpportunities = [...stats].sort((a, b) => b.opportunitiesCreated - a.opportunitiesCreated).slice(0, 20);

  console.log('  #   Keyword                                  Runs  Posts  Valid  Opps   Conv%');
  console.log('  ' + '─'.repeat(85));

  byOpportunities.forEach((s, i) => {
    const keyword = s.keyword.slice(0, 40).padEnd(40);
    const runs = String(s.runs).padStart(4);
    const posts = String(s.postsReceived).padStart(5);
    const valid = String(s.postsProcessed).padStart(5);
    const opps = String(s.opportunitiesCreated).padStart(5);
    const conv = s.conversionRate.toFixed(1).padStart(6);
    console.log(`  ${String(i + 1).padStart(2)}. ${keyword}  ${runs}  ${posts}  ${valid}  ${opps}  ${conv}%`);
  });

  // === TOP PERFORMERS BY CONVERSION RATE (min 5 runs, min 10 posts) ===
  console.log('\n═══ ТОП-20 ПО КОНВЕРСИИ (мин. 5 запусков, 10 постов) ═══\n');
  const byConversion = [...stats]
    .filter(s => s.runs >= 5 && s.postsReceived >= 10)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 20);

  console.log('  #   Keyword                                  Runs  Posts  Opps   Conv%  Avg/Run');
  console.log('  ' + '─'.repeat(85));

  byConversion.forEach((s, i) => {
    const keyword = s.keyword.slice(0, 40).padEnd(40);
    const runs = String(s.runs).padStart(4);
    const posts = String(s.postsReceived).padStart(5);
    const opps = String(s.opportunitiesCreated).padStart(5);
    const conv = s.conversionRate.toFixed(1).padStart(6);
    const avgPerRun = s.avgOppsPerRun.toFixed(2).padStart(7);
    console.log(`  ${String(i + 1).padStart(2)}. ${keyword}  ${runs}  ${posts}  ${opps}  ${conv}%  ${avgPerRun}`);
  });

  // === WORST PERFORMERS (lots of posts, no opportunities) ===
  console.log('\n═══ НЕЭФФЕКТИВНЫЕ (много постов, мало результата) ═══\n');
  const worst = [...stats]
    .filter(s => s.postsReceived >= 20 && s.conversionRate < 3)
    .sort((a, b) => a.conversionRate - b.conversionRate)
    .slice(0, 15);

  if (worst.length === 0) {
    console.log('  Нет ключевиков с конверсией < 3% при 20+ постах');
  } else {
    console.log('  #   Keyword                                  Runs  Posts  Opps   Conv%  ⚠️');
    console.log('  ' + '─'.repeat(85));

    worst.forEach((s, i) => {
      const keyword = s.keyword.slice(0, 40).padEnd(40);
      const runs = String(s.runs).padStart(4);
      const posts = String(s.postsReceived).padStart(5);
      const opps = String(s.opportunitiesCreated).padStart(5);
      const conv = s.conversionRate.toFixed(1).padStart(6);
      const warning = s.opportunitiesCreated === 0 ? '❌ УДАЛИТЬ' : '⚠️ ПРОВЕРИТЬ';
      console.log(`  ${String(i + 1).padStart(2)}. ${keyword}  ${runs}  ${posts}  ${opps}  ${conv}%  ${warning}`);
    });
  }

  // === ZERO RESULTS ===
  console.log('\n═══ НУЛЕВОЙ РЕЗУЛЬТАТ (0 opportunities) ═══\n');
  const zeroResults = stats.filter(s => s.opportunitiesCreated === 0 && s.runs >= 3);

  if (zeroResults.length === 0) {
    console.log('  Все ключевики дают результат!');
  } else {
    console.log(`  Найдено ${zeroResults.length} ключевиков с 0 opportunities (при 3+ запусках):\n`);
    zeroResults.forEach((s) => {
      console.log(`  ❌ "${s.keyword}" — ${s.runs} запусков, ${s.postsReceived} постов, 0 результата`);
    });
  }

  // === NEVER USED ===
  console.log('\n═══ НЕ ИСПОЛЬЗОВАЛИСЬ ═══\n');
  const unusedKeywords = stats.filter(s => s.runs === 0);

  if (unusedKeywords.length === 0) {
    console.log('  Все ключевики использовались!');
  } else {
    console.log(`  ${unusedKeywords.length} ключевиков ни разу не запускались`);
  }

  // === HIGH VOLUME LOW VALIDATION ===
  console.log('\n═══ НИЗКАЯ ВАЛИДАЦИЯ (много постов, мало job-постов) ═══\n');
  const lowValidation = [...stats]
    .filter(s => s.postsReceived >= 20 && s.validationRate < 30)
    .sort((a, b) => a.validationRate - b.validationRate)
    .slice(0, 10);

  if (lowValidation.length === 0) {
    console.log('  Нет ключевиков с валидацией < 30% при 20+ постах');
  } else {
    console.log('  Keyword                                  Posts  Valid%  (много мусора)');
    console.log('  ' + '─'.repeat(65));
    lowValidation.forEach((s) => {
      const keyword = s.keyword.slice(0, 40).padEnd(40);
      const posts = String(s.postsReceived).padStart(5);
      const valid = s.validationRate.toFixed(1).padStart(6);
      console.log(`  ${keyword}  ${posts}  ${valid}%`);
    });
  }

  // === CATEGORY BREAKDOWN ===
  console.log('\n═══ ПО КАТЕГОРИЯМ ═══\n');

  const categories: Record<string, { keywords: number; posts: number; opps: number }> = {
    'Translation (by language)': { keywords: 0, posts: 0, opps: 0 },
    'Interpreters (by language)': { keywords: 0, posts: 0, opps: 0 },
    'Translation (general)': { keywords: 0, posts: 0, opps: 0 },
    'Freelance (general)': { keywords: 0, posts: 0, opps: 0 },
    'Engineering': { keywords: 0, posts: 0, opps: 0 },
    'Design': { keywords: 0, posts: 0, opps: 0 },
    'Writing': { keywords: 0, posts: 0, opps: 0 },
    'Marketing': { keywords: 0, posts: 0, opps: 0 },
    'Creative': { keywords: 0, posts: 0, opps: 0 },
    'QA': { keywords: 0, posts: 0, opps: 0 },
    'Other': { keywords: 0, posts: 0, opps: 0 },
  };

  for (const s of stats) {
    const kw = s.keyword.toLowerCase();
    let cat = 'Other';

    if (kw.includes('translator') && !kw.includes('looking') && !kw.includes('hiring') && !kw.includes('need')) {
      cat = 'Translation (by language)';
    } else if (kw.includes('interpreter') && !kw.includes('looking') && !kw.includes('hiring') && !kw.includes('need')) {
      cat = 'Interpreters (by language)';
    } else if (kw.includes('translat') || kw.includes('locali') || kw.includes('subtitle') || kw.includes('mtpe') || kw.includes('linguist')) {
      cat = 'Translation (general)';
    } else if (kw.includes('freelance') && (kw.includes('developer') || kw.includes('engineer') || kw.includes('react') || kw.includes('fullstack') || kw.includes('backend'))) {
      cat = 'Engineering';
    } else if (kw.includes('designer') || kw.includes('ux')) {
      cat = 'Design';
    } else if (kw.includes('writer') || kw.includes('copywriter') || kw.includes('editor')) {
      cat = 'Writing';
    } else if (kw.includes('marketing') || kw.includes('seo') || kw.includes('growth') || kw.includes('social media')) {
      cat = 'Marketing';
    } else if (kw.includes('video') || kw.includes('motion') || kw.includes('animator') || kw.includes('illustrator') || kw.includes('photographer') || kw.includes('creative')) {
      cat = 'Creative';
    } else if (kw.includes('qa') || kw.includes('tester') || kw.includes('lqa')) {
      cat = 'QA';
    } else if (kw.includes('freelance') || kw.includes('contractor') || kw.includes('project')) {
      cat = 'Freelance (general)';
    }

    categories[cat].keywords++;
    categories[cat].posts += s.postsReceived;
    categories[cat].opps += s.opportunitiesCreated;
  }

  console.log('  Category                      Keywords   Posts    Opps   Conv%');
  console.log('  ' + '─'.repeat(65));

  const sortedCats = Object.entries(categories)
    .filter(([_, v]) => v.keywords > 0)
    .sort((a, b) => b[1].opps - a[1].opps);

  for (const [cat, v] of sortedCats) {
    const catName = cat.padEnd(28);
    const keywords = String(v.keywords).padStart(8);
    const posts = String(v.posts).padStart(7);
    const opps = String(v.opps).padStart(7);
    const conv = v.posts > 0 ? ((v.opps / v.posts) * 100).toFixed(1).padStart(6) : '  0.0';
    console.log(`  ${catName}  ${keywords}  ${posts}  ${opps}  ${conv}%`);
  }

  // === RECOMMENDATIONS ===
  console.log('\n═══ РЕКОМЕНДАЦИИ ═══\n');

  // Keywords to remove
  const toRemove = stats.filter(s =>
    (s.runs >= 5 && s.opportunitiesCreated === 0) ||
    (s.postsReceived >= 30 && s.conversionRate < 1)
  );

  if (toRemove.length > 0) {
    console.log('  🗑️  УДАЛИТЬ (бесполезные):');
    toRemove.slice(0, 10).forEach(s => {
      console.log(`      "${s.keyword}" — ${s.runs} запусков, ${s.postsReceived} постов, ${s.opportunitiesCreated} opps`);
    });
    if (toRemove.length > 10) {
      console.log(`      ... и ещё ${toRemove.length - 10}`);
    }
  }

  // Keywords doing well
  const topPerformers = stats
    .filter(s => s.runs >= 3 && s.conversionRate >= 15)
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 5);

  if (topPerformers.length > 0) {
    console.log('\n  ⭐ ЛУЧШИЕ (конверсия 15%+):');
    topPerformers.forEach(s => {
      console.log(`      "${s.keyword}" — ${s.conversionRate.toFixed(1)}% конверсия, ${s.opportunitiesCreated} opps`);
    });
  }

  console.log('\n═══ КОНЕЦ АНАЛИЗА ═══\n');
}

analyze()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
