-- Track 2 (deliverability) migration — additive & idempotent (safe to re-run, drops nothing).
-- Run on prod (machine with DB access, e.g. Hetzner):
--   psql "$DATABASE_URL" -f scripts/recruiter-suppression-migrate.sql
--
-- Suppression list of recruiter addresses we must not send auto-apply outreach to (one-click
-- List-Unsubscribe opt-outs, later hard bounces). The send loop fails OPEN if this table is
-- missing, so running the migration late only means opt-outs aren't yet honored — never an outage.
CREATE TABLE IF NOT EXISTS "RecruiterSuppression" (
  "email"     TEXT PRIMARY KEY,                              -- lowercased recruiter email
  "reason"    TEXT NOT NULL DEFAULT 'optout',                -- 'optout' | 'bounce' | 'complaint'
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
