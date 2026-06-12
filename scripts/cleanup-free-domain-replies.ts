/**
 * Cleanup: free-domain résumé-farm "replies" (2026-06-12).
 *
 * Context: free-domain demand was cut at import/match/send on 2026-06-07 (commit 255dde2),
 * but ~5.7k applications sent BEFORE the cutoff kept receiving farm auto-replies (mass
 * "Congratulations" templates weeks later, salary/PII harvesting — e.g. "Neuberg Stewart" /
 * impact.recruiting.org@gmail.com). Those fake replies sat in user inboxes as live leads and
 * inflated NSM. The inbound-reply webhook now drops new ones; this script cleans the backlog.
 *
 * What it does — for AutoApplications with a free-domain appliedToEmail, repliedAt set and
 * status REPLIED (INTERVIEW/OFFER threads are spared — the user advanced them, let them decide):
 *   - status        → SENT          (drops them out of /dashboard/inbox)
 *   - replyCategory → SPAM          (audit trail; replyText/repliedAt preserved)
 *   - recruiterHidden → true        (drops them off the recruiter portal)
 *
 * NSM note: stat queries counting connections must exclude replyCategory='SPAM'.
 *
 * Usage: DATABASE_URL=... npx tsx scripts/cleanup-free-domain-replies.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { isFreeEmailProvider } from '../src/lib/content-quality';

const prisma = new PrismaClient();
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const candidates = await prisma.autoApplication.findMany({
    where: { repliedAt: { not: null }, status: 'REPLIED' },
    select: { id: true, appliedToEmail: true, companyName: true },
  });

  const farm = candidates.filter((a) => isFreeEmailProvider(a.appliedToEmail));
  console.log(`replied REPLIED apps: ${candidates.length}, free-domain to clean: ${farm.length}`);

  const byCompany = new Map<string, number>();
  for (const a of farm) byCompany.set(a.companyName, (byCompany.get(a.companyName) || 0) + 1);
  const top = [...byCompany.entries()].sort((x, y) => y[1] - x[1]).slice(0, 10);
  console.log('top sources:', top.map(([c, n]) => `${c}:${n}`).join('  '));

  if (dryRun) {
    console.log('[dry-run] no changes written');
    return;
  }

  const res = await prisma.autoApplication.updateMany({
    where: { id: { in: farm.map((a) => a.id) } },
    data: { status: 'SENT', replyCategory: 'SPAM', recruiterHidden: true },
  });
  console.log(`updated: ${res.count}`);
}

main().finally(() => prisma.$disconnect());
