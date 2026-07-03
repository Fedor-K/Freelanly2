import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runGitHubReview } from '@/lib/github-review/run';

// On-demand (re-)run of the GitHub evidence review for one candidate — admin-only, used by the
// button on /admin/users/[id]. force:true bypasses the 30d/profileStamp freshness cache.
export const maxDuration = 60;

const ADMIN_EMAILS = ['fedor.hatla@gmail.com'];

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const result = await runGitHubReview(id, { force: true });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[Admin GitHubReview] failed:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
