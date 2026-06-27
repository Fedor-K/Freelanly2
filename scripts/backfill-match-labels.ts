// Phase 2 backfill — re-derive AutoApplication.matchLabel from the STORED breakdown using the FIXED
// computeCaveats (CAVEATS-1/2 + the profession='different' guard). The recruiter portal (/r) and the
// feed verified-queue read these stored rows, so a stale false "Strong" keeps showing until corrected.
//
// DOWNGRADE-ONLY: we never upgrade a stored label (that could surface previously-hidden rows). We only
// correct a stored Strong/Good that the current logic says is actually weaker — and reconcile the
// stored matchScore into the new band so the fit ring can't contradict the label.
//
// Forward-only limitation: rows whose breakdown was written by the old send-time SHADOW have their
// profession/hard_fail STRIPPED (that's CAVEATS-1), so 'different'/hard-fail can't be re-detected from
// them — but zero-evidence / zero-coverage / 0-requirement Strongs ARE recovered. New sends (post
// CAVEATS-1 fix) store the gated breakdown, so they're correct at write time.
//
// Run (DRY-RUN):  DATABASE_URL="…" npx tsx scripts/backfill-match-labels.ts
// Run (APPLY):    DATABASE_URL="…" npx tsx scripts/backfill-match-labels.ts --apply
import { prisma } from '@/lib/db';
import { computeCaveats, reconcileScore } from '@/lib/match-caveats';

const RANK: Record<string, number> = { Strong: 0, Good: 1, Weak: 2 };
const APPLY = process.argv.includes('--apply');
const log = (...a: unknown[]) => console.error(...a);

async function main() {
  const BATCH = 1000;
  let cursor: string | undefined;
  let scanned = 0;
  const transitions: Record<string, number> = {};
  const samples: Record<string, unknown[]> = {};
  const updates: { id: string; newLabel: string; newScore: number | null }[] = [];

  for (;;) {
    const rows: Array<{ id: string; matchLabel: string | null; matchScore: number | null; matchBreakdown: unknown }> =
      await prisma.autoApplication.findMany({
        where: { matchLabel: { in: ['Strong', 'Good'] } },
        select: { id: true, matchLabel: true, matchScore: true, matchBreakdown: true },
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
    if (!rows.length) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      scanned++;
      const bd = r.matchBreakdown as Record<string, unknown> | null;
      if (!bd || bd.error) continue;                       // no/broken breakdown → leave as-is
      const recomputed = computeCaveats(bd)?.strength;
      if (!recomputed) continue;
      const cur = r.matchLabel as string;
      if (RANK[recomputed] > RANK[cur]) {                  // strictly weaker → correct it
        const key = `${cur}→${recomputed}`;
        transitions[key] = (transitions[key] || 0) + 1;
        updates.push({ id: r.id, newLabel: recomputed, newScore: reconcileScore(r.matchScore, recomputed) });
        (samples[key] ||= []);
        if (samples[key].length < 6) {
          const cav = computeCaveats(bd);
          samples[key].push({ matched: bd.matched, total: bd.total, profession: bd.profession ?? null, why: cav?.items ?? [] });
        }
      }
    }
    log(`scanned ${scanned}, downgrades queued ${updates.length}…`);
  }

  console.log(JSON.stringify({ scanned, downgrades: updates.length, transitions, samples, apply: APPLY }, null, 2));

  if (!APPLY) { console.log('DRY-RUN — no writes. Re-run with --apply to persist.'); return; }

  // Apply in small concurrent chunks.
  let done = 0;
  for (let i = 0; i < updates.length; i += 25) {
    await Promise.all(updates.slice(i, i + 25).map((u) =>
      prisma.autoApplication.update({ where: { id: u.id }, data: { matchLabel: u.newLabel, matchScore: u.newScore } })));
    done += Math.min(25, updates.length - i);
    if (done % 200 === 0 || done === updates.length) log(`updated ${done}/${updates.length}`);
  }
  console.log(`APPLIED ${done} label corrections.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
