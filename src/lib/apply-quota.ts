import { prisma } from '@/lib/db';

/** Max applies per UTC day for users sending through Freelanly's SHARED Postal domain
 *  (owner decision 2026-07-17: with the match gate removed, this cap is the only anti-spam brake;
 *  PRO's old unlimited would let one user burn the shared domain). */
export const FREE_DAILY_APPLY_LIMIT = 20;

/** Max applies per UTC day for OWN-ACCOUNT senders — users who send via their OWN mailbox (Gmail OAuth
 *  or a verified custom SMTP) instead of the shared Postal domain. The 20/day brake exists to protect
 *  the shared domain, which these users don't touch — the only thing at stake is their own inbox
 *  (bounded by their provider, e.g. Gmail ~500/day) and our per-send AI cost. So they get a much
 *  higher, env-tunable ceiling. Default 200. */
export const OWN_ACCOUNT_DAILY_LIMIT = (() => {
  const n = parseInt(process.env.OWN_ACCOUNT_DAILY_LIMIT || '', 10);
  return Number.isFinite(n) && n > 0 ? n : 200;
})();

/** Does this user send via their own mailbox (Gmail OAuth or a custom SMTP)? Fail-CLOSED (→ false,
 *  the safe shared-domain limit) if the lookup errors. */
export async function hasOwnAccount(userId: string): Promise<boolean> {
  try {
    const [gmail, smtp] = await Promise.all([
      prisma.gmailAuth.findUnique({ where: { userId }, select: { userId: true } }),
      prisma.userSmtp.findUnique({ where: { userId }, select: { userId: true } }),
    ]);
    return !!(gmail || smtp);
  } catch {
    return false;
  }
}

/** Batched own-account lookup: the subset of `userIds` that send via their own Gmail/SMTP.
 *  Fail-CLOSED (→ empty set) so a lookup error keeps everyone on the shared-domain limit. */
export async function getOwnAccountUserIds(userIds: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (userIds.length === 0) return out;
  try {
    const [gmails, smtps] = await Promise.all([
      prisma.gmailAuth.findMany({ where: { userId: { in: userIds } }, select: { userId: true } }),
      prisma.userSmtp.findMany({ where: { userId: { in: userIds } }, select: { userId: true } }),
    ]);
    for (const g of gmails) out.add(g.userId);
    for (const s of smtps) out.add(s.userId);
  } catch { /* fail-closed: everyone stays on FREE_DAILY_APPLY_LIMIT */ }
  return out;
}

/** Effective daily apply cap for a user: the higher own-account ceiling for own-mailbox senders,
 *  otherwise the shared-domain limit. */
export async function dailyApplyLimit(userId: string): Promise<number> {
  return (await hasOwnAccount(userId)) ? OWN_ACCOUNT_DAILY_LIMIT : FREE_DAILY_APPLY_LIMIT;
}

/**
 * Atomically consume one daily apply slot before sending — applies to ALL plans.
 *
 * The check + increment happen in ONE conditional UPDATE, so it is TOCTOU-safe
 * (parallel requests can't all pass a read-then-write check) and works regardless
 * of the send path (the old code only incremented on the SMTP branch, so the Postal
 * branch — the default for inline applicants — never moved the counter → unlimited).
 *
 * The daily ceiling is per-user: own-account senders (Gmail/SMTP) get OWN_ACCOUNT_DAILY_LIMIT,
 * everyone else FREE_DAILY_APPLY_LIMIT (see dailyApplyLimit).
 *
 * Resets the counter when the last apply was on an earlier UTC day.
 *
 * @returns true if a slot was consumed (caller may send), false if at the daily limit.
 */
export async function consumeApplyQuota(userId: string, _plan: string): Promise<boolean> {
  const limit = await dailyApplyLimit(userId);

  const rows = await prisma.$queryRaw<{ freeAppliesUsedToday: number }[]>`
    UPDATE "User"
    SET "freeAppliesUsedToday" = CASE
          WHEN "lastFreeApplyReset" < date_trunc('day', now() AT TIME ZONE 'UTC') THEN 1
          ELSE "freeAppliesUsedToday" + 1 END,
        "lastFreeApplyReset" = now()
    WHERE id = ${userId}
      AND ("lastFreeApplyReset" < date_trunc('day', now() AT TIME ZONE 'UTC')
           OR "freeAppliesUsedToday" < ${limit})
    RETURNING "freeAppliesUsedToday"`;

  return rows.length === 1;
}

/**
 * Refund a previously consumed slot (e.g. the send failed after consume).
 * All plans; floors at 0. Best-effort.
 */
export async function refundApplyQuota(userId: string, _plan: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "User"
    SET "freeAppliesUsedToday" = GREATEST("freeAppliesUsedToday" - 1, 0)
    WHERE id = ${userId}`.then(() => {}).catch(() => {});
}
