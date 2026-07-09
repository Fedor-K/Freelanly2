-- GmailAuth migration — additive & idempotent (safe to re-run, drops nothing).
-- Run on prod BEFORE deploying the matching code:
--   psql "$DATABASE_URL" -f scripts/gmail-auth-migrate.sql
-- (or via the db-query Prisma $executeRawUnsafe path, one statement at a time).
--
-- Why manual: `prisma db push` is NOT safe here (schema.prisma has drifted from prod, a push would
-- DROP unknown columns). Vercel build only runs `prisma generate`. So new tables go in by hand.

CREATE TABLE IF NOT EXISTS "GmailAuth" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  "verified"     BOOLEAN NOT NULL DEFAULT true,
  "lastError"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GmailAuth_pkey" PRIMARY KEY ("id")
);

-- one row per user
CREATE UNIQUE INDEX IF NOT EXISTS "GmailAuth_userId_key" ON "GmailAuth"("userId");

-- FK to User with cascade delete (mirrors UserSmtp). Guarded so re-runs don't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GmailAuth_userId_fkey' AND table_name = 'GmailAuth'
  ) THEN
    ALTER TABLE "GmailAuth"
      ADD CONSTRAINT "GmailAuth_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
