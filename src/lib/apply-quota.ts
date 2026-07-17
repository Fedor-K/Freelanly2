import { prisma } from '@/lib/db';

/** Max applies per UTC day — EVERY plan (owner decision 2026-07-17: with the match gate removed,
 *  this cap is the only anti-spam brake; PRO's old unlimited would let one user burn the domain). */
export const FREE_DAILY_APPLY_LIMIT = 20;

/**
 * Atomically consume one daily apply slot before sending — applies to ALL plans.
 *
 * The check + increment happen in ONE conditional UPDATE, so it is TOCTOU-safe
 * (parallel requests can't all pass a read-then-write check) and works regardless
 * of the send path (the old code only incremented on the SMTP branch, so the Postal
 * branch — the default for inline applicants — never moved the counter → unlimited).
 *
 * Resets the counter when the last apply was on an earlier UTC day.
 *
 * @returns true if a slot was consumed (caller may send), false if at the daily limit.
 */
export async function consumeApplyQuota(userId: string, _plan: string): Promise<boolean> {

  const rows = await prisma.$queryRaw<{ freeAppliesUsedToday: number }[]>`
    UPDATE "User"
    SET "freeAppliesUsedToday" = CASE
          WHEN "lastFreeApplyReset" < date_trunc('day', now() AT TIME ZONE 'UTC') THEN 1
          ELSE "freeAppliesUsedToday" + 1 END,
        "lastFreeApplyReset" = now()
    WHERE id = ${userId}
      AND ("lastFreeApplyReset" < date_trunc('day', now() AT TIME ZONE 'UTC')
           OR "freeAppliesUsedToday" < ${FREE_DAILY_APPLY_LIMIT})
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
