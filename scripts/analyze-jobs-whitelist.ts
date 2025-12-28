/**
 * Analyze all jobs against whitelist filter
 * Shows which jobs would pass/fail the profession filter
 */

import { prisma } from '../src/lib/db';
import { shouldImportByProfession, isTargetProfession, isBlacklistedProfession } from '../src/config/target-professions';

async function main() {
  console.log('=== Analyzing all jobs against whitelist filter ===\n');

  const jobs = await prisma.job.findMany({
    select: {
      id: true,
      title: true,
      locationType: true,
      source: true,
      company: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`Total jobs in database: ${jobs.length}\n`);

  const passed: typeof jobs = [];
  const failed: { job: typeof jobs[0]; reason: string }[] = [];

  for (const job of jobs) {
    if (shouldImportByProfession(job.title)) {
      passed.push(job);
    } else {
      const reason = isBlacklistedProfession(job.title)
        ? 'blacklisted'
        : 'not in whitelist';
      failed.push({ job, reason });
    }
  }

  console.log('=== SUMMARY ===');
  console.log(`✅ PASSED (match whitelist): ${passed.length} (${(passed.length / jobs.length * 100).toFixed(1)}%)`);
  console.log(`❌ FAILED (would be filtered): ${failed.length} (${(failed.length / jobs.length * 100).toFixed(1)}%)`);
  console.log('');

  // Group failed by reason
  const blacklisted = failed.filter(f => f.reason === 'blacklisted');
  const notInWhitelist = failed.filter(f => f.reason === 'not in whitelist');

  console.log(`  - Blacklisted: ${blacklisted.length}`);
  console.log(`  - Not in whitelist: ${notInWhitelist.length}`);
  console.log('');

  // Show passed by location type
  console.log('=== PASSED BY LOCATION TYPE ===');
  const passedByLocation: Record<string, number> = {};
  for (const job of passed) {
    const loc = job.locationType || 'UNKNOWN';
    passedByLocation[loc] = (passedByLocation[loc] || 0) + 1;
  }
  for (const [loc, count] of Object.entries(passedByLocation).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${loc}: ${count}`);
  }
  console.log('');

  // Show failed jobs grouped by title patterns
  console.log('=== FAILED JOBS (would be filtered out) ===\n');

  // Group by similar titles
  const titleGroups: Record<string, typeof failed> = {};
  for (const item of failed) {
    // Simplify title for grouping
    const simplified = item.job.title
      .toLowerCase()
      .replace(/\s+(sr|senior|jr|junior|lead|principal|staff|ii|iii|iv|v)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!titleGroups[simplified]) {
      titleGroups[simplified] = [];
    }
    titleGroups[simplified].push(item);
  }

  // Sort by count and show
  const sortedGroups = Object.entries(titleGroups)
    .sort((a, b) => b[1].length - a[1].length);

  console.log('Grouped by similar titles (sorted by count):');
  console.log('');

  let shownCount = 0;
  for (const [title, items] of sortedGroups) {
    if (shownCount >= 50) break; // Show top 50 groups

    const example = items[0].job;
    const companies = [...new Set(items.map(i => i.job.company?.name || 'Unknown'))].slice(0, 3);

    console.log(`[${items.length}x] "${example.title}"`);
    console.log(`     Companies: ${companies.join(', ')}${items.length > 3 ? '...' : ''}`);
    console.log(`     Reason: ${items[0].reason}`);
    console.log('');

    shownCount++;
  }

  if (sortedGroups.length > 50) {
    console.log(`... and ${sortedGroups.length - 50} more unique titles\n`);
  }

  // Show some specific examples of passed jobs
  console.log('=== EXAMPLES OF PASSED JOBS ===\n');

  const passedByType: Record<string, typeof jobs[0][]> = {};
  for (const job of passed.slice(0, 200)) {
    const loc = job.locationType || 'UNKNOWN';
    if (!passedByType[loc]) passedByType[loc] = [];
    if (passedByType[loc].length < 5) {
      passedByType[loc].push(job);
    }
  }

  for (const [loc, examples] of Object.entries(passedByType)) {
    console.log(`${loc}:`);
    for (const job of examples) {
      console.log(`  - "${job.title}" @ ${job.company?.name}`);
    }
    console.log('');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
