-- Recurring daily-matches digest marker. Added via raw DDL (NOT `prisma db push`, which would
-- force-reset). Idempotent. Run once against the Neon DB.
--
-- lastDailyDigestAt = timestamp of the last digest actually SENT to this user (null = never sent).
-- The service only considers opportunities created after this timestamp (capped by a lookback
-- window), so a given opportunity is emailed to a user at most once.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastDailyDigestAt" TIMESTAMP;
