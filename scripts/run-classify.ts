// Worker entry for the role-family classify cron (Hetzner /opt/worker/run-classify.sh, same shape as
// run-embed.ts — env from .env, run under tsx). Steady tick: fills a batch of NULL roleFamily on
// Opportunity + User via local qwen2.5:3b. `drain` loops until nothing is left. Fail-soft: qwen down
// => rows stay NULL => the feed shows them unfiltered.
import { ensureClassifySchema, fillMissingRoleFamily } from '@/services/classify/classify-worker';
import { prisma } from '@/lib/db';

const DRAIN = process.argv.includes('drain');

async function main() {
  const t0 = Date.now();
  await ensureClassifySchema();
  if (!DRAIN) {
    const r = await fillMissingRoleFamily();
    console.error(`[classify] tick: opps=${r.opps} users=${r.users} in ${Date.now() - t0}ms`);
    return;
  }
  let round = 0;
  for (;;) {
    round++;
    const r = await fillMissingRoleFamily();
    const moved = r.opps + r.users;
    console.error(`[classify] drain round ${round}: opps=${r.opps} users=${r.users}`);
    if (moved === 0) break;
  }
  console.error(`[classify] drain complete in ${Date.now() - t0}ms`);
}

main()
  .catch((e) => { console.error('[classify] fatal:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
