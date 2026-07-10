import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildAuthUrl, signState } from '@/lib/gmail-oauth';

// GET /api/user/gmail-oauth/start?return=/path[&signup=1]
// Two modes, one Google consent (openid email profile + gmail.send):
// - CONNECT (default): an authed user links Gmail sending to their existing account.
// - SIGNUP (?signup=1): no session required — "Continue with Google" registration/login. The callback
//   finds-or-creates the user from Google's verified email, mints the session AND stores the send grant,
//   so one click replaces the whole OTP dance and connects their inbox at the same time.
export async function GET(request: NextRequest) {
  const session = await auth();
  const wantsSignup = request.nextUrl.searchParams.get('signup') === '1';

  const returnPath = request.nextUrl.searchParams.get('return') || '/dashboard/settings';
  const safeReturn = returnPath.startsWith('/') ? returnPath : '/dashboard/settings';

  // An already-authed user always gets connect mode (even from a signup button — e.g. an existing
  // user clicking "Continue with Google" simply links Gmail and proceeds).
  let state: string;
  if (session?.user?.id) {
    state = signState(session.user.id, safeReturn);
  } else if (wantsSignup) {
    state = signState(null, safeReturn, true);
  } else {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  const url = buildAuthUrl(state, session?.user?.email || undefined);
  if (!url) {
    // GOOGLE_CLIENT_ID/SECRET not configured
    return NextResponse.redirect(new URL(`${safeReturn}${safeReturn.includes('?') ? '&' : '?'}gmail=unconfigured`, request.url));
  }
  return NextResponse.redirect(url);
}
