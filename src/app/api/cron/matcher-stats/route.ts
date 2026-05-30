import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * Read-only diagnostics for the auto-apply matcher.
 *
 * Reports the unprocessed backlog and recent throughput so matcher health can be
 * checked over HTTPS (the only egress that works from sandboxed sessions; raw
 * Postgres TCP does not). Guarded by CRON_SECRET. Side-effect-free except an
 * idempotent ADD COLUMN IF NOT EXISTS so it never 500s if the marker column is
 * not present yet.
 */
async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Idempotent — keeps this endpoint working even if the matcher has not run yet.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "matchedAt" TIMESTAMP(3)`
    );

    const [row] = await prisma.$queryRawUnsafe<
      {
        unprocessed_3d: number;
        total_3d: number;
        matched_last_15m: number;
        matched_last_60m: number;
        oldest_unprocessed: Date | null;
      }[]
    >(`
      SELECT
        COUNT(*) FILTER (
          WHERE "matchedAt" IS NULL
        )::int AS unprocessed_3d,
        COUNT(*)::int AS total_3d,
        (SELECT COUNT(*)::int FROM "Opportunity"
          WHERE "matchedAt" >= NOW() - INTERVAL '15 minutes') AS matched_last_15m,
        (SELECT COUNT(*)::int FROM "Opportunity"
          WHERE "matchedAt" >= NOW() - INTERVAL '60 minutes') AS matched_last_60m,
        MIN("createdAt") FILTER (WHERE "matchedAt" IS NULL) AS oldest_unprocessed
      FROM "Opportunity"
      WHERE "isActive" = true
        AND "applyEmail" IS NOT NULL
        AND "createdAt" >= NOW() - INTERVAL '3 days'
    `);

    const apps15m = await prisma.autoApplication.count({
      where: { createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    });
    const sent15m = await prisma.autoApplication.count({
      where: { sentAt: { gte: new Date(Date.now() - 15 * 60 * 1000) } },
    });

    const oldestAgeMin = row.oldest_unprocessed
      ? Math.round((Date.now() - new Date(row.oldest_unprocessed).getTime()) / 60000)
      : null;

    return NextResponse.json({
      ok: true,
      now: new Date().toISOString(),
      backlog: {
        unprocessed_3d: row.unprocessed_3d,
        total_3d: row.total_3d,
        oldest_unprocessed_age_min: oldestAgeMin,
      },
      throughput: {
        matched_last_15m: row.matched_last_15m,
        matched_last_60m: row.matched_last_60m,
        applications_created_last_15m: apps15m,
        applications_sent_last_15m: sent15m,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
