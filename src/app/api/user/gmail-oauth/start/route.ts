import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildAuthUrl, signState } from '@/lib/gmail-oauth';

// GET /api/user/gmail-oauth/start?return=/path
// Kicks off the Gmail `gmail.send` OAuth grant. Full-page redirect to Google's consent screen.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  const returnPath = request.nextUrl.searchParams.get('return') || '/dashboard/settings';
  const safeReturn = returnPath.startsWith('/') ? returnPath : '/dashboard/settings';

  const state = signState(session.user.id, safeReturn);
  const url = buildAuthUrl(state, session.user.email || undefined);
  if (!url) {
    // GOOGLE_CLIENT_ID/SECRET not configured
    return NextResponse.redirect(new URL(`${safeReturn}${safeReturn.includes('?') ? '&' : '?'}gmail=unconfigured`, request.url));
  }
  return NextResponse.redirect(url);
}
