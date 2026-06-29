// Worker entry for the embedding fill cron (Hetzner /opt/worker/run-embed.sh, same shape as the other
// run-*.sh wrappers — env from .env, run under tsx).
//
//   Steady cron (every 2-3 min):  npx tsx scripts/run-embed.ts
//   One-time backfill (drain all): npx tsx scripts/run-embed.ts drain
//
// DATABASE_URL + EMBED_BASE_URL/EMBED_MODEL come from the environment. Fail-soft: if the model server
// is down, fillMissingEmbeddings no-ops and rows stay NULL (feed falls back to lexical).
import { ensureEmbedSchema, fillMissingEmbeddings } from '@/services/embeddings/embed-worker';
import { prisma } from '@/lib/db';

const DRAIN = process.argv.includes('drain');

async function main() {
  const t0 = Date.now();
  await ensureEmbedSchema();

  if (!DRAIN) {
    const r = await fillMissingEmbeddings();
    console.error(`[embed] tick: opps=${r.opps} users=${r.users} jobs=${r.jobs} stale=${r.stale} in ${Date.now() - t0}ms`);
    return;
  }

  // Backfill: loop until a full pass embeds nothing new (NULLs drained).
  let round = 0;
  for (;;) {
    round++;
    const r = await fillMissingEmbeddings();
    const moved = r.opps + r.users + r.jobs + r.stale;
    console.error(`[embed] drain round ${round}: opps=${r.opps} users=${r.users} jobs=${r.jobs} stale=${r.stale}`);
    if (moved === 0) break;
  }
  console.error(`[embed] drain complete in ${Date.now() - t0}ms`);
}

main()
  .catch((e) => { console.error('[embed] fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
