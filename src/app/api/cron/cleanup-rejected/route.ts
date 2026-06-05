import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/cron/cleanup-rejected
 *
 * Prunes audit-only REJECTED AutoApplication rows older than 7 days. The matcher logs every
 * considered pairing (sent + rejected-with-reason) so the admin audit shows "who/why", which is
 * ~12k rejected rows/hour — left unbounded the table balloons (~2M rows/week) and the audit page
 * slows down. We keep the last 7 days of rejections (the audit windows are 24h/7d/30d, so the
 * useful debugging window stays intact) and NEVER touch real outreach (SENT/DELIVERED/OPENED/
 * REPLIED/INTERVIEW/OFFER), in-flight (PENDING/REVIEW/SENDING), SKIPPED, or FAILED.
 *
 * Batched: the first run can be millions of rows, so we delete in chunks and stay under the
 * function time budget — whatever's left is picked up by the next daily run. Runs daily via Vercel cron.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const BATCH = 5000;
  const MAX_MS = 250_000; // stay under the 300s function limit
  const started = Date.now();
  let total = 0;
  let batches = 0;

  try {
    for (let i = 0; i < 2000; i++) {
      if (Date.now() - started > MAX_MS) break;
      const deleted: number = await prisma.$executeRaw`
        DELETE FROM "AutoApplication"
        WHERE id IN (
          SELECT id FROM "AutoApplication"
          WHERE status = 'REJECTED' AND "createdAt" < ${cutoff}
          LIMIT ${BATCH}
        )`;
      total += deleted;
      batches++;
      if (deleted < BATCH) break; // drained
    }

    console.log(`[CleanupRejected] deleted ${total} REJECTED rows older than ${cutoff.toISOString()} in ${batches} batches`);
    return NextResponse.json({ success: true, deleted: total, batches, cutoff: cutoff.toISOString(), tookMs: Date.now() - started });
  } catch (error) {
    console.error('[CleanupRejected] error:', error);
    return NextResponse.json({ error: 'Failed', details: String(error), deletedSoFar: total }, { status: 500 });
  }
}

// GET for easy manual trigger / testing
export async function GET(request: NextRequest) {
  return POST(request);
}
