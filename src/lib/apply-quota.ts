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

// ─────────────────────────────────────────────────────────────────────────────
// PAY-PER-APPLY CREDITS (owner decision 2026-07-21)
//
// The MONEY gate (distinct from the daily anti-spam brake above): a FREE user's first FREE_APPLICATIONS
// sends are free (priorSends < FREE_APPLICATIONS), then each further send needs a purchased credit.
// $3 buys a pack.
// Charged on-session via inline Stripe Elements — replaces the $5/mo subscription redirect that
// abandoned 97% at the Stripe hosted page. PRO/ENTERPRISE stay unlimited. own-inbox is NOT exempt here
// (that exemption is only for the anti-spam daily cap — this is about product value, not send channel).
//
// Rollout-safe: when CREDITS_ENABLED=false the behaviour is IDENTICAL to today (past-free FREE user →
// hard wall, no credit path), so this whole block is dormant until the flag is flipped.
// ─────────────────────────────────────────────────────────────────────────────

/** Feature flag — when false, past-free FREE users hit the legacy hard wall (no credits, $5/mo copy). */
export const CREDITS_ENABLED = process.env.CREDITS_ENABLED === 'true';
/** Lifetime free sends before payment kicks in.
 *  1 → 3 (2026-08-11): at one free send the wall landed before the product had proved anything —
 *  over 14 days 927 users hit it having sent 1.01 applications on average, 96% with no recruiter
 *  reply yet, and 91% never even clicked "pay".
 *  3 → 2 (owner decision 2026-08-15): three worked on the send side and failed on the money side.
 *  Sends per user rose from ~1.1 to 1.64, but paywall impressions collapsed from ~90/day to 11–19
 *  and two consecutive days produced no payments at all. The three payments on the first day came
 *  from a one-off backlog — 8k users stuck at one free send were released at once — and did not
 *  repeat. Two keeps the part that worked (the user sees the machine deliver before being asked to
 *  pay) and returns roughly half the paywall exposure. Anyone already at 2 or 3 is walled at once.
 *
 *  DELIBERATELY NOT env-tunable. It was, and a stale FREE_APPLICATIONS=1 in the Vercel dashboard
 *  silently outranked the raise: the pricing page, landing FAQ and llms.txt shipped promising three
 *  free applications while the gate kept walling users at one (29 users with freeSendsUsed=1 were
 *  walled on 2026-08-12 before this was caught). A pricing promise that a dashboard value can quietly
 *  contradict is worse than a redeploy — change the number here, where the copy can be changed with it. */
export const FREE_APPLICATIONS: number = 2;
/** Applies granted per purchased pack. */
export const CREDIT_PACK_SIZE = Number(process.env.CREDIT_PACK_SIZE ?? 6);
/** Price of one pack, in cents (USD). */
export const CREDIT_PACK_PRICE_CENTS = Number(process.env.CREDIT_PACK_PRICE_CENTS ?? 300);

/**
 * READ-ONLY pre-check (no consume): may this user send another application without paying now?
 * true if PRO/ENTERPRISE, or still within the free allowance, or (credits enabled) holds ≥1 credit.
 * Used at the draft/pre-send stage to decide whether to show the paywall — never mutates state.
 * (The authoritative, race-safe gate is consumeApplyCredit; this is only a UX pre-check.)
 */
export async function hasApplyAllowance(userId: string, plan: string): Promise<boolean> {
  if (plan !== 'FREE') return true;                       // PRO/ENTERPRISE unlimited
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { freeSendsUsed: true, applyCredits: true } });
  if ((u?.freeSendsUsed ?? 0) < FREE_APPLICATIONS) return true; // still within the free allowance
  if (!CREDITS_ENABLED) return false;                     // legacy hard wall
  return (u?.applyCredits ?? 0) > 0;
}

/**
 * Consume the money-gate slot ATOMICALLY, called immediately before an irreversible send (after all
 * other gates pass). Both the free-allowance claim and the credit decrement are single conditional
 * UPDATEs, so N concurrent requests claim at most FREE_APPLICATIONS free sends + the real credit
 * balance — no TOCTOU bypass. (freeSendsUsed is a lifetime counter, backfilled from sent history so
 * existing users aren't re-granted a free send.)
 *
 * @returns { allowed, creditConsumed, freeReserved }. If !allowed the caller must NOT send (show
 *          paywall). On send failure the caller MUST refund whatever was taken: refundApplyCredit() if
 *          creditConsumed, refundFreeSend() if freeReserved.
 */
export async function consumeApplyCredit(userId: string, plan: string): Promise<{ allowed: boolean; creditConsumed: boolean; freeReserved: boolean }> {
  if (plan !== 'FREE') return { allowed: true, creditConsumed: false, freeReserved: false };

  // 1. Claim a lifetime FREE send atomically (check + increment in ONE conditional UPDATE).
  const freeRows = await prisma.$queryRaw<{ freeSendsUsed: number }[]>`
    UPDATE "User" SET "freeSendsUsed" = "freeSendsUsed" + 1
    WHERE id = ${userId} AND "freeSendsUsed" < ${FREE_APPLICATIONS}
    RETURNING "freeSendsUsed"`;
  if (freeRows.length === 1) return { allowed: true, creditConsumed: false, freeReserved: true };

  // 2. Free allowance spent → need a purchased credit (only when credits are enabled).
  if (!CREDITS_ENABLED) return { allowed: false, creditConsumed: false, freeReserved: false };
  const credRows = await prisma.$queryRaw<{ applyCredits: number }[]>`
    UPDATE "User" SET "applyCredits" = "applyCredits" - 1
    WHERE id = ${userId} AND "applyCredits" > 0
    RETURNING "applyCredits"`;
  return credRows.length === 1
    ? { allowed: true, creditConsumed: true, freeReserved: false }
    : { allowed: false, creditConsumed: false, freeReserved: false };
}

/** Refund one apply credit (send failed after consumeApplyCredit reported creditConsumed). Best-effort. */
export async function refundApplyCredit(userId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "User" SET "applyCredits" = "applyCredits" + 1 WHERE id = ${userId}`
    .then(() => {}).catch(() => {});
}

/** Refund a claimed free-send slot (send failed after consumeApplyCredit reported freeReserved). Best-effort. */
export async function refundFreeSend(userId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "User" SET "freeSendsUsed" = GREATEST("freeSendsUsed" - 1, 0) WHERE id = ${userId}`
    .then(() => {}).catch(() => {});
}

/** Revoke previously-granted apply credits (Stripe refund / chargeback dispute). Clamped at 0. Best-effort. */
export async function revokeApplyCredits(userId: string, n: number): Promise<void> {
  if (!(n > 0)) return;
  await prisma.$executeRaw`
    UPDATE "User" SET "applyCredits" = GREATEST("applyCredits" - ${n}, 0) WHERE id = ${userId}`
    .then(() => {}).catch(() => {});
}

/**
 * Body for the 402 "application_limit" response. When CREDITS_ENABLED, advertises the $3/pack offer
 * (new frontend renders the inline-charge modal); when off, the legacy $5/mo copy (unchanged behaviour
 * for the current frontend, which ignores the extra fields).
 */
export function applyLimitResponse(to?: string): Record<string, unknown> {
  // This message IS the paywall headline — the frontend renders it verbatim and it overrides the
  // component's own fallback copy. So it must count off the constant: hardcoding "your free
  // application" states a false number the moment FREE_APPLICATIONS is anything but 1.
  const spent = FREE_APPLICATIONS === 1
    ? 'Your free application is used.'
    : `Your ${FREE_APPLICATIONS} free applications are used.`;
  return {
    error: 'application_limit',
    needsPurchase: CREDITS_ENABLED,
    offer: CREDITS_ENABLED ? 'credits' : 'subscription',
    packSize: CREDIT_PACK_SIZE,
    packPriceCents: CREDIT_PACK_PRICE_CENTS,
    message: CREDITS_ENABLED
      ? `${spent} Top up your balance to keep applying — $0.50 per application (min $3 top-up, never expires).`
      : `${spent} Keep applying with PRO ($5/mo) — AI-written letters, your CV attached to every one.`,
    ...(to ? { to } : {}),
  };
}
