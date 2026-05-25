import { prisma } from '@/lib/db';

/** FREE plan: max auto-applies per UTC day. Single source of truth. */
export const FREE_DAILY_APPLY_LIMIT = 20;

/**
 * Atomically consume one daily apply slot for a FREE user before sending.
 *
 * The check + increment happen in ONE conditional UPDATE, so it is TOCTOU-safe
 * (parallel requests can't all pass a read-then-write check) and works regardless
 * of the send path (the old code only incremented on the SMTP branch, so the Postal
 * branch — the default for inline applicants — never moved the counter → unlimited).
 *
 * Resets the counter when the last apply was on an earlier UTC day. PRO/other plans
 * are unlimited and always allowed (no row touched).
 *
 * @returns true if a slot was consumed (caller may send), false if at the daily limit.
 */
export async function consumeApplyQuota(userId: string, plan: string): Promise<boolean> {
  if (plan !== 'FREE') return true; // PRO and others: unlimited

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
 * No-op for PRO; floors at 0. Best-effort.
 */
export async function refundApplyQuota(userId: string, plan: string): Promise<void> {
  if (plan !== 'FREE') return;
  await prisma.$executeRaw`
    UPDATE "User"
    SET "freeAppliesUsedToday" = GREATEST("freeAppliesUsedToday" - 1, 0)
    WHERE id = ${userId}`.then(() => {}).catch(() => {});
}
