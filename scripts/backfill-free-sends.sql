-- Pay-per-apply: backfill User.freeSendsUsed after the column is added (Phase 0).
--
-- The first-free gate switched from counting sent AutoApplications (a non-atomic read, TOCTOU-bypassable)
-- to an atomic lifetime counter `freeSendsUsed`. New column defaults to 0, so WITHOUT this backfill every
-- existing user who already spent their free application would be granted a fresh one on deploy. This
-- marks 1 free send used for anyone who has ever sent — preserving current behaviour.
--
-- Assumes FREE_APPLICATIONS = 1 (the current value). If that env is raised, backfill LEAST(N, sent_count)
-- instead. Idempotent (guarded by freeSendsUsed = 0). Run once, right after `prisma db push`.

UPDATE "User" u
SET "freeSendsUsed" = 1
WHERE u."freeSendsUsed" = 0
  AND EXISTS (
    SELECT 1 FROM "AutoApplication" a
    WHERE a."userId" = u.id AND a."sentAt" IS NOT NULL
  );
