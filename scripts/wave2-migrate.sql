-- Wave 2 migration — additive & idempotent (safe to re-run, drops nothing).
-- Run on prod BEFORE deploying the matching code:
--   psql "$DATABASE_URL" -f scripts/wave2-migrate.sql
-- (or via the db-query Prisma $executeRawUnsafe path, one statement at a time).
--
-- Why manual: the Vercel build runs `prisma generate`, never a migration, and the worker
-- doesn't migrate either — schema changes in this project are applied by hand (same as the
-- matchedAt raw-SQL column). `prisma db push` is NOT safe here: schema.prisma has drifted from
-- prod, so a push would try to DROP unknown columns. These additive statements don't.

-- 1) Contact-reveal log (shadow paywall) — new table, nothing reads it until the new code ships.
CREATE TABLE IF NOT EXISTS "ContactReveal" (
  "id"             TEXT PRIMARY KEY,
  "applicationId"  TEXT NOT NULL,
  "recruiterEmail" TEXT NOT NULL,
  "revealedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactReveal_applicationId_recruiterEmail_key" UNIQUE ("applicationId", "recruiterEmail")
);
CREATE INDEX IF NOT EXISTS "ContactReveal_recruiterEmail_idx" ON "ContactReveal" ("recruiterEmail");
CREATE INDEX IF NOT EXISTS "ContactReveal_applicationId_idx"  ON "ContactReveal" ("applicationId");

-- 2) Job-alert opt-in scaffold on User. MUST exist before the new Prisma client deploys —
--    otherwise full-model User selects fail ("column does not exist"). That's why this runs first.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobAlertOptIn"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jobAlertOptInAt" TIMESTAMP(3);
