/**
 * One-time pivot: self-apply becomes the default; auto-apply becomes opt-in.
 *   1. Flip every AUTO loop → MANUAL (matcher still surfaces matches as REVIEW, but the send cron
 *      sends only PENDING, so auto-send stops). SEMI/MANUAL loops are left as-is.
 *   2. Cancel in-flight auto-sends: any PENDING AutoApplication → SKIPPED, so the backlog doesn't
 *      fire after the pivot. SKIPPED is excluded from the feed + per-recipient caps. REVIEW rows
 *      (the surfaced matches) are untouched.
 *
 * Safe to re-run (idempotent). Run AFTER deploying the AUTO→MANUAL default change, so no new AUTO
 * loops are created mid-migration.
 *
 *   npx tsx scripts/migrate-loops-to-manual.ts
 *   npx tsx scripts/migrate-loops-to-manual.ts --dry   # report only, no writes
 */
import { prisma } from '../src/lib/db';

async function main() {
  const dry = process.argv.includes('--dry');

  const autoLoops = await prisma.autoApplyLoop.count({ where: { mode: 'AUTO' } });
  const pending = await prisma.autoApplication.count({ where: { status: 'PENDING' } });
  console.log(`[pivot] AUTO loops to flip: ${autoLoops} | PENDING applications to cancel: ${pending}${dry ? '  (DRY RUN)' : ''}`);

  if (dry) { await prisma.$disconnect(); return; }

  const flipped = await prisma.autoApplyLoop.updateMany({
    where: { mode: 'AUTO' },
    data: { mode: 'MANUAL' },
  });
  const cancelled = await prisma.autoApplication.updateMany({
    where: { status: 'PENDING' },
    data: { status: 'SKIPPED', errorMessage: 'auto-apply paused (self-apply pivot)' },
  });

  console.log(`[pivot] flipped ${flipped.count} loops → MANUAL; cancelled ${cancelled.count} PENDING → SKIPPED`);

  const remaining = await prisma.autoApplyLoop.groupBy({ by: ['mode'], _count: { _all: true } });
  console.log('[pivot] loop mode distribution now:', remaining.map(r => `${r.mode}=${r._count._all}`).join(', '));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
