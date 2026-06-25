import { NextRequest, NextResponse } from 'next/server';
import { ingestActiveLeverRoles } from '@/services/sources/lever-ingest';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

/**
 * Ingest fresh ATS (Lever) roles into the Opportunity table so they appear in the candidate
 * discovery feed (external-apply). Fetch + DB only (no SMTP) → Vercel-safe, but the full ~2000-slug
 * sweep exceeds the 300s function cap, so the Vercel cron processes a small "freshest N" slice
 * (?limit=); the Hetzner worker runs the full set with a large limit.
 */
export const maxDuration = 300;

async function handle(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return NextResponse.json({ skipped: true, reason: 'non-production deployment' });
  }
  try {
    const limit = parseInt(new URL(request.url).searchParams.get('limit') || '80') || 80;
    const result = await ingestActiveLeverRoles(limit);
    console.log(`[Cron] ingest-ats: ${result.companies} companies, +${result.created} new, ${result.duplicate} dup, ${result.skipped} skipped`);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('[Cron] ingest-ats failed:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Vercel cron invokes via GET; Hetzner/manual triggers via POST (Bearer). Same logic.
export const GET = handle;
export const POST = handle;
