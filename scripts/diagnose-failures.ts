/**
 * Diagnose FAILED auto-applications: WHY they fail and WHETHER it's still happening.
 * 44% of all attempts are FAILED — this groups them by reason and recency so we know if it's
 * expiry (send too slow), filters (language/skills), or delivery (SMTP/bounce). Read-only.
 *
 *   npx tsx scripts/diagnose-failures.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Collapse free-form errorMessage into stable buckets (the variable bits — languages, SMTP
// detail — are stripped so counts group cleanly).
function bucket(msg: string | null): string {
  if (!msg) return '(no message)';
  const m = msg.toLowerCase();
  if (m.includes('expired') || m.includes('older than')) return 'Expired (not sent within 24h)';
  if (m.includes("doesn't speak") || m.includes('speak')) return 'Language mismatch';
  if (m.includes('no skills') || m.includes('resume may be invalid')) return 'Empty/invalid profile';
  if (m.includes('blocked apply domain')) return 'Blocked apply domain';
  if (m.includes('unsubscribed')) return 'Recruiter unsubscribed';
  if (m.includes('negative cover letter')) return 'AI refused (poor match)';
  if (m.includes('loop is paused')) return 'Loop paused';
  if (m.includes('smtp') || m.includes('ebusy') || m.includes('econn') || m.includes('postal') || m.includes('send failed')) return 'Delivery/SMTP error';
  if (m.includes('quota') || m.includes('limit')) return 'Quota/limit';
  return `Other: ${msg.slice(0, 50)}`;
}

async function main() {
  const failed = await prisma.autoApplication.findMany({
    where: { status: 'FAILED' },
    select: { errorMessage: true, createdAt: true },
  });

  const total = failed.length;
  console.log(`\nFAILED total: ${total.toLocaleString()}\n`);

  // By reason.
  const byReason = new Map<string, number>();
  const now = Date.now();
  let last24h = 0, last7d = 0;
  for (const f of failed) {
    const b = bucket(f.errorMessage);
    byReason.set(b, (byReason.get(b) || 0) + 1);
    const age = now - new Date(f.createdAt).getTime();
    if (age <= 864e5) last24h++;
    if (age <= 7 * 864e5) last7d++;
  }

  console.log('=== BY REASON ===');
  for (const [reason, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) {
    const p = Math.round((n / total) * 1000) / 10;
    console.log(`  ${String(n).padStart(7).toLocaleString()}  ${String(p + '%').padStart(6)}  ${reason}`);
  }

  console.log('\n=== BY RECENCY (is it still happening?) ===');
  console.log(`  Last 24h: ${last24h.toLocaleString()}`);
  console.log(`  Last 7d:  ${last7d.toLocaleString()}`);
  console.log(`  Older:    ${(total - last7d).toLocaleString()}`);

  // Recent-only reason split — what's failing NOW (post all the recent fixes).
  const recent = failed.filter((f) => now - new Date(f.createdAt).getTime() <= 7 * 864e5);
  if (recent.length > 0) {
    const recentByReason = new Map<string, number>();
    for (const f of recent) {
      const b = bucket(f.errorMessage);
      recentByReason.set(b, (recentByReason.get(b) || 0) + 1);
    }
    console.log('\n=== LAST 7 DAYS — BY REASON (what to fix now) ===');
    for (const [reason, n] of [...recentByReason.entries()].sort((a, b) => b[1] - a[1])) {
      const p = Math.round((n / recent.length) * 1000) / 10;
      console.log(`  ${String(n).padStart(7)}  ${String(p + '%').padStart(6)}  ${reason}`);
    }
  }
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
