import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * POST /api/cron/cleanup-incomplete-users
 *
 * Deletes accounts that never completed onboarding: missing a résumé OR a LinkedIn
 * profile (i.e. not "full cycle"). Only accounts OLDER THAN 24h are touched, so users
 * mid-signup or who'll come back tomorrow are never nuked. PRO accounts are always spared.
 *
 * Owner decision 2026-06-18: keep the base lean — only working (full-cycle) profiles, on
 * which the auto-apply engine actually fires. Runs daily via Vercel cron.
 */
const GRACE_MS = 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - GRACE_MS);

    // Incomplete = missing résumé OR missing LinkedIn. Older than grace. FREE only
    // (PRO/ENTERPRISE are always spared even if their profile looks incomplete).
    const where = {
      createdAt: { lt: cutoff },
      plan: 'FREE' as const,
      OR: [{ resumeUrl: null }, { linkedinUrl: null }],
    };

    const eligible = await prisma.user.count({ where });
    if (eligible === 0) {
      console.log('[CleanupIncomplete] nothing to delete');
      return NextResponse.json({ deleted: 0 });
    }

    const del = await prisma.user.deleteMany({ where });
    console.log(`[CleanupIncomplete] deleted ${del.count} incomplete accounts (older than 24h, missing résumé/LinkedIn)`);
    return NextResponse.json({ deleted: del.count });
  } catch (error) {
    console.error('[CleanupIncomplete] error:', error);
    return NextResponse.json({ error: 'Failed', details: String(error) }, { status: 500 });
  }
}

// GET for easy manual trigger / testing
export async function GET(request: NextRequest) {
  return POST(request);
}
