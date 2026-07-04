import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runFeedVetSlice } from '@/services/feed-vet';

// One vetting slice for the calling user's direction pool (vetted-only feed). The DiscoveryFeed
// client polls this while the feed is open: first polls fill a fresh user's feed behind the
// "Matching to your profile…" screen, later polls pick up newly-ingested opportunities (the
// "N new matches" banner). Budget/caps enforced inside runFeedVetSlice.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let maxPairs = 24;
  try {
    const body = await request.json();
    if (typeof body?.maxPairs === 'number') maxPairs = Math.max(0, Math.min(48, body.maxPairs));
  } catch { /* empty body → defaults */ }
  try {
    const status = await runFeedVetSlice(session.user.id, maxPairs);
    if (!status) return NextResponse.json({ error: 'no_profile' }, { status: 400 });
    return NextResponse.json(status);
  } catch (e) {
    console.error('[FeedVet] slice failed:', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'vet_failed' }, { status: 500 });
  }
}
