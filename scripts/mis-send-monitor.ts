/**
 * Mis-send monitor for the blacklist-only switch (2026-06-13).
 *
 * After dropping the whitelist (default-allow + blacklist), this measures whether the matcher's
 * downstream gates actually hold: of recruiter-bound SENDS, what fraction went to opportunities
 * whose title is NOT a whitelisted target profession (= "newly allowed" by the flip). Those split
 * into legit roles the whitelist used to miss (good — recovered supply) and off-target junk that
 * slipped the gates (bad — mis-send). Sample the titles to eyeball the ratio.
 *
 * Target: off-target % near zero. If it climbs, the gates aren't holding → restore broad whitelist.
 *
 * Run daily: DATABASE_URL=... npx tsx scripts/mis-send-monitor.ts [days]
 */
import { PrismaClient } from '@prisma/client';
import { isTargetProfession } from '../src/config/target-professions';

const p = new PrismaClient();
const days = Number(process.argv[2] || 3);

async function main() {
  const rows = (await p.$queryRawUnsafe(`
    SELECT DISTINCT o.id, o.title
    FROM "AutoApplication" a JOIN "Opportunity" o ON o.id = a."opportunityId"
    WHERE a."sentAt" > NOW() - INTERVAL '${days} days' AND o.title IS NOT NULL`)) as any[];

  // weight by send count, not unique opp, to reflect real candidate exposure
  const sends = (await p.$queryRawUnsafe(`
    SELECT o.title, COUNT(*)::int n
    FROM "AutoApplication" a JOIN "Opportunity" o ON o.id = a."opportunityId"
    WHERE a."sentAt" > NOW() - INTERVAL '${days} days' AND o.title IS NOT NULL
    GROUP BY 1`)) as any[];

  let totalSends = 0, offTargetSends = 0;
  const offTitles: string[] = [];
  for (const r of sends) {
    totalSends += r.n;
    if (!isTargetProfession(r.title)) { offTargetSends += r.n; if (offTitles.length < 40) offTitles.push(`${r.n}× ${r.title}`); }
  }
  console.log(`=== mis-send monitor (last ${days}d) ===`);
  console.log(`sends: ${totalSends} | to non-whitelisted titles: ${offTargetSends} (${(100*offTargetSends/totalSends).toFixed(1)}%)`);
  console.log(`unique opps sent: ${rows.length} | non-whitelisted: ${rows.filter(r=>!isTargetProfession(r.title)).length}`);
  console.log('\n--- sample of non-whitelisted titles we SENT to (judge legit vs junk) ---');
  for (const t of offTitles.sort((a,b)=>parseInt(b)-parseInt(a))) console.log('  ' + t);
}
main().finally(() => p.$disconnect());
