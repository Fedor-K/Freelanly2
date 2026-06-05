/**
 * One-time backfill: assign professional directions (categorySlugs) to every existing AutoApplyLoop,
 * so the matcher's direction routing (src/lib/loop-routing.ts) applies to the existing base, not just
 * new loops. Recomputes from the loop's jobTitles + keywords + the user's parsed profile.
 *
 * Safe to re-run (idempotent — recomputes and overwrites). Empty result for a loop = left empty =
 * matcher fails open for it (old behaviour), so nothing breaks.
 *
 *   npx tsx scripts/backfill-loop-categories.ts          # all loops
 *   npx tsx scripts/backfill-loop-categories.ts --active # only active loops (faster, what matters now)
 */
import { prisma } from '../src/lib/db';
import { deriveCategorySlugs } from '../src/lib/loop-routing';

async function main() {
  const onlyActive = process.argv.includes('--active');
  const loops = await prisma.autoApplyLoop.findMany({
    where: onlyActive ? { isActive: true } : {},
    select: {
      id: true, jobTitles: true, keywords: true,
      user: { select: { parsedProfile: true } },
    },
  });
  console.log(`[backfill] ${loops.length} loops${onlyActive ? ' (active only)' : ''}`);

  const dist: Record<string, number> = {};
  let updated = 0, empty = 0;
  for (const loop of loops) {
    const p = (loop.user?.parsedProfile as Record<string, unknown> | null) || null;
    const cats = deriveCategorySlugs({
      jobTitles: loop.jobTitles,
      currentTitle: (p?.current_title as string) || null,
      field: (p?.field as string) || null,
      skills: (p?.skills as string[]) || [],
      // keywords folded in as extra skill terms
      ...(loop.keywords ? { skills: [ ...((p?.skills as string[]) || []), ...loop.keywords.split(',') ] } : {}),
    });
    await prisma.autoApplyLoop.update({ where: { id: loop.id }, data: { categorySlugs: cats } });
    if (cats.length === 0) empty++; else updated++;
    for (const c of cats) dist[c] = (dist[c] || 0) + 1;
  }

  console.log(`[backfill] done: ${updated} classified, ${empty} empty (fail-open)`);
  console.log('[backfill] direction distribution:');
  for (const [slug, n] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${slug.padEnd(20)} ${n}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
