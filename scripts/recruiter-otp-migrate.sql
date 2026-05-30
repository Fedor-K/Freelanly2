-- Recruiter OTP login migration — additive & idempotent (drops nothing).
-- Run on prod (machine with DB access):
--   psql "$DATABASE_URL" -f scripts/recruiter-otp-migrate.sql
--
-- Backs the passwordless recruiter login (email + 6-digit code → session cookie). The code is
-- stored hashed; one active row per email. Until this runs, the OTP login routes error gracefully
-- (the existing /r/<token> email-link portal is unaffected).
CREATE TABLE IF NOT EXISTS "RecruiterOtp" (
  "email"     TEXT PRIMARY KEY,                              -- lowercased recruiter email
  "codeHash"  TEXT NOT NULL,                                 -- sha256 of the 6-digit code
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts"  INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
