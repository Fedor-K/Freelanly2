// Offline calibration for SEM_FLOOR (Phase 0 — no product change). Over the gate verdicts we already
// have (PairingVerdict from user-applies + MatchVerdict from the matcher), compute the candidate↔opp
// cosine similarity and show how it separates SEND (real match) from NO (rejected). Pick the floor
// that keeps almost all SENDs while cutting the most NOs.
//
//   Prereq: embeddings backfilled (run-embed drain) so User/Opportunity rows have vectors.
//   Run: DATABASE_URL="…" npx tsx scripts/calibrate-sem-floor.ts
import { prisma } from '@/lib/db';

type Pt = { decision: string; sim: number };

function pct(sorted: number[], p: number): number {
  if (!sorted.length) return NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i];
}
const r2 = (x: number) => Math.round(x * 1000) / 1000;

async function main() {
  const rows = await prisma.$queryRawUnsafe<Pt[]>(`
    SELECT decision, sim FROM (
      SELECT pv.decision AS decision, 1 - (u.embedding <=> o.embedding) AS sim
      FROM "PairingVerdict" pv
      JOIN "User" u ON u.id = pv."userId" AND u.embedding IS NOT NULL
      JOIN "Opportunity" o ON o.id = pv."opportunityId" AND o.embedding IS NOT NULL
      UNION ALL
      SELECT mv.decision AS decision, 1 - (u.embedding <=> o.embedding) AS sim
      FROM "MatchVerdict" mv
      JOIN "User" u ON u.id = mv."userId" AND u.embedding IS NOT NULL
      JOIN "Opportunity" o ON o.id = mv."opportunityId" AND o.embedding IS NOT NULL
    ) x
    WHERE decision IN ('SEND', 'NO')`);

  const send = rows.filter((r) => r.decision === 'SEND').map((r) => Number(r.sim)).sort((a, b) => a - b);
  const no = rows.filter((r) => r.decision === 'NO').map((r) => Number(r.sim)).sort((a, b) => a - b);

  console.log(`pairs with both vectors: SEND=${send.length}  NO=${no.length}`);
  if (send.length < 20 || no.length < 20) {
    console.log('⚠ too few embedded verdict pairs — backfill embeddings first (npx tsx scripts/run-embed.ts drain), then re-run.');
  }

  const dist = (label: string, a: number[]) =>
    console.log(`${label.padEnd(5)} sim  p05=${r2(pct(a, 5))} p25=${r2(pct(a, 25))} p50=${r2(pct(a, 50))} p75=${r2(pct(a, 75))} p95=${r2(pct(a, 95))}`);
  dist('SEND', send);
  dist('NO', no);

  // Sweep candidate floors: how many SENDs survive (recall) vs NOs cut (precision gain).
  console.log('\nfloor   keepSEND%   cutNO%');
  for (const f of [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60]) {
    const keep = send.filter((s) => s >= f).length / (send.length || 1);
    const cut = no.filter((s) => s < f).length / (no.length || 1);
    console.log(`${f.toFixed(2)}    ${(100 * keep).toFixed(1)}%      ${(100 * cut).toFixed(1)}%`);
  }
  // A sensible default: the 5th percentile of SEND (keeps ~95% of real matches).
  console.log(`\nsuggested SEM_FLOOR ≈ ${r2(pct(send, 5))} (keeps ~95% of SENDs); verify the cutNO% column above is high there.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
