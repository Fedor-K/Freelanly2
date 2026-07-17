-- Day+1 matched-roles one-shot marker (2026-07-17).
-- Run on prod BEFORE deploying the code that references it — a deployed Prisma client
-- that knows a column the DB lacks breaks all full-model User selects (wave2 precedent).
-- prisma db push is FORBIDDEN in this repo (drops worker-managed objects) — raw DDL only:
--   node with $executeRawUnsafe, or: psql "$DATABASE_URL" -f scripts/day1-matches-migrate.sql
-- Applied to prod: 2026-07-17.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "day1DigestSentAt" TIMESTAMP(3);
