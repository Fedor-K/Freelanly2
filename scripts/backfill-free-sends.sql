-- Pay-per-apply: backfill User.freeSendsUsed after the column is added (Phase 0).
--
-- The first-free gate switched from counting sent AutoApplications (a non-atomic read, TOCTOU-bypassable)
-- to an atomic lifetime counter `freeSendsUsed`. New column defaults to 0, so WITHOUT this backfill every
-- existing user who already spent their free application would be granted a fresh one on deploy. This
-- marks 1 free send used for anyone who has ever sent — preserving current behaviour.
--
-- Written when FREE_APPLICATIONS was 1, and ALREADY RUN under that value. The allowance is now 3, so
-- do NOT re-run this as-is against a fresh column: it would mark only 1 of the 3 free sends used. For a
-- re-backfill use LEAST(FREE_APPLICATIONS, sent_count). Raising the allowance intentionally hands the
-- extra sends to everyone stamped with 1 here. Idempotent (guarded by freeSendsUsed = 0).

UPDATE "User" u
SET "freeSendsUsed" = 1
WHERE u."freeSendsUsed" = 0
  AND EXISTS (
    SELECT 1 FROM "AutoApplication" a
    WHERE a."userId" = u.id AND a."sentAt" IS NOT NULL
  );
