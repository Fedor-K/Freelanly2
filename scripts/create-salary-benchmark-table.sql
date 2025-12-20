-- SQL script to manually create SalaryBenchmark table
-- Run this in Neon SQL console if `prisma db push` doesn't create the table

-- First, create the enum type (if it doesn't exist)
DO $$ BEGIN
    CREATE TYPE "SalarySource" AS ENUM ('BLS', 'ADZUNA', 'CALCULATED', 'ESTIMATED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create the SalaryBenchmark table
CREATE TABLE IF NOT EXISTS "SalaryBenchmark" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT '',
    "minSalary" INTEGER NOT NULL,
    "maxSalary" INTEGER NOT NULL,
    "avgSalary" INTEGER NOT NULL,
    "medianSalary" INTEGER NOT NULL,
    "percentile25" INTEGER NOT NULL,
    "percentile75" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "source" "SalarySource" NOT NULL,
    "sourceCode" TEXT,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryBenchmark_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS "SalaryBenchmark_jobTitle_country_region_key"
ON "SalaryBenchmark"("jobTitle", "country", "region");

-- Create indexes
CREATE INDEX IF NOT EXISTS "SalaryBenchmark_jobTitle_idx" ON "SalaryBenchmark"("jobTitle");
CREATE INDEX IF NOT EXISTS "SalaryBenchmark_country_idx" ON "SalaryBenchmark"("country");
CREATE INDEX IF NOT EXISTS "SalaryBenchmark_expiresAt_idx" ON "SalaryBenchmark"("expiresAt");

-- Verify table was created
SELECT
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'SalaryBenchmark'
ORDER BY ordinal_position;
