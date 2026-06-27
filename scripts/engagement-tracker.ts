// Feed / dashboard ENGAGEMENT tracker. The candidate-engagement loop is the product:
//   relevant jobs → help them apply → they come back (→ stay warm → respond when a recruiter writes).
// This reports the loop's health per MSK day (today-so-far vs the prior full MSK day), so we can see
// whether matcher/feed fixes actually move return-rate, relevance, and apply-success.
// Run: DATABASE_URL="…" npx tsx scripts/engagement-tracker.ts
import { prisma } from '@/lib/db';

// MSK = UTC+3. Compute [start of today MSK, start of prior MSK day] as real UTC instants.
const now = new Date();
const msk = new Date(now.getTime() + 3 * 3600e3);
const todayStartUTC = new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate()) - 3 * 3600e3);
const priorStartUTC = new Date(todayStartUTC.getTime() - 24 * 3600e3);
const weekAgoUTC = new Date(todayStartUTC.getTime() - 7 * 24 * 3600e3);
const iso = (d: Date) => d.toISOString();

async function num(sql: string): Promise<number> {
  const r = await prisma.$queryRawUnsafe<{ n: number | bigint }[]>(sql);
  return r[0] ? Number(r[0].n) : 0;
}
const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

async function main() {
  const T = iso(todayStartUTC), P = iso(priorStartUTC), W = iso(weekAgoUTC);

  // ── RETURN ───────────────────────────────────────────────────────────────
  // D1 retention: of users who signed up on the PRIOR MSK day, how many were active TODAY.
  const signupsPrior = await num(`SELECT CAST(COUNT(*) AS INT) n FROM "User" WHERE "createdAt">='${P}' AND "createdAt"<'${T}'`);
  const d1Returned = await num(`SELECT CAST(COUNT(DISTINCT u.id) AS INT) n FROM "User" u JOIN "ActivityLog" a ON a."userId"=u.id WHERE u."createdAt">='${P}' AND u."createdAt"<'${T}' AND a."createdAt">='${T}'`);
  const dauToday = await num(`SELECT CAST(COUNT(DISTINCT "userId") AS INT) n FROM "ActivityLog" WHERE "createdAt">='${T}' AND "userId" IS NOT NULL`);
  const returningToday = await num(`SELECT CAST(COUNT(DISTINCT a."userId") AS INT) n FROM "ActivityLog" a JOIN "User" u ON u.id=a."userId" WHERE a."createdAt">='${T}' AND u."createdAt"<'${T}'`);
  const feedViewers7d = await num(`SELECT CAST(COUNT(DISTINCT "userId") AS INT) n FROM "ActivityLog" WHERE action::text='PAGE_VIEW' AND "pageUrl" ILIKE '%discovery%' AND "createdAt">='${W}'`);
  const feedRepeat7d = await num(`SELECT CAST(COUNT(*) AS INT) n FROM (SELECT "userId" FROM "ActivityLog" WHERE action::text='PAGE_VIEW' AND "pageUrl" ILIKE '%discovery%' AND "createdAt">='${W}' GROUP BY "userId" HAVING COUNT(*)>=2) x`);

  // ── RELEVANCE (feed shows the right jobs?) ───────────────────────────────
  // poor_match rate on feed apply attempts = the feed promised a match the gate then rejected.
  const fdPoor = await num(`SELECT CAST(COUNT(*) AS INT) n FROM "ActivityLog" WHERE action::text='APPLY_DRAFT' AND details->>'method'='feed' AND details->>'reason'='poor_match' AND "createdAt">='${W}'`);
  const fdTotal = await num(`SELECT CAST(COUNT(*) AS INT) n FROM "ActivityLog" WHERE action::text='APPLY_DRAFT' AND details->>'method'='feed' AND "createdAt">='${W}'`);

  // ── APPLY (help them apply) ──────────────────────────────────────────────
  const feedClicks7d = await num(`SELECT CAST(COUNT(*) AS INT) n FROM "ActivityLog" WHERE action::text='OPPORTUNITY_APPLY_CLICK' AND details->>'method'='feed' AND "createdAt">='${W}'`);
  const feedSends7d = await num(`SELECT CAST(COUNT(*) AS INT) n FROM "ActivityLog" WHERE action::text='QUICK_APPLY' AND details->>'method'='feed' AND "createdAt">='${W}'`);
  const optinFeed7d = await num(`SELECT CAST(COUNT(*) AS INT) n FROM "ActivityLog" WHERE action::text='AUTO_APPLY_ENABLED' AND details->>'source'='discovery_onboard' AND "createdAt">='${W}'`);

  // ── NORTH-STAR anchor (connection): recruiter wrote → candidate responded ─
  const replied = await num(`SELECT CAST(COUNT(*) AS INT) n FROM "AutoApplication" WHERE "repliedAt" IS NOT NULL AND ("replyCategory" IS NULL OR "replyCategory"<>'SPAM')`);
  const responded = await num(`SELECT CAST(COUNT(*) AS INT) n FROM "AutoApplication" a WHERE a."repliedAt" IS NOT NULL AND (a."replyCategory" IS NULL OR a."replyCategory"<>'SPAM') AND EXISTS(SELECT 1 FROM "Message" m WHERE m."applicationId"=a.id AND m."from"='user' AND m."createdAt">a."repliedAt")`);

  const out = [
    `📊 ENGAGEMENT TRACKER — MSK day ${msk.toISOString().slice(0, 10)} (today-so-far)`,
    ``,
    `RETURN (do they come back?)`,
    `  • D1 retention (prior-day signups active today): ${d1Returned}/${signupsPrior} = ${pct(d1Returned, signupsPrior)}%`,
    `  • DAU today: ${dauToday}  (returning, not new: ${returningToday})`,
    `  • Feed return-rate (7d, ≥2 visits): ${feedRepeat7d}/${feedViewers7d} = ${pct(feedRepeat7d, feedViewers7d)}%`,
    ``,
    `RELEVANCE (right jobs shown?)`,
    `  • Feed poor_match rate (7d): ${fdPoor}/${fdTotal} = ${pct(fdPoor, fdTotal)}%  (lower = more relevant; pre-vet should cut it)`,
    ``,
    `APPLY (do we help them apply?)`,
    `  • Feed click→send: ${feedSends7d}/${feedClicks7d} = ${pct(feedSends7d, feedClicks7d)}% (7d)`,
    `  • Auto-apply opt-in FROM feed (7d): ${optinFeed7d}`,
    ``,
    `NORTH STAR (connection): recruiter wrote ${replied} → candidate responded ${responded} = ${pct(responded, replied)}% (all-time)`,
  ].join('\n');
  console.log(out);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
