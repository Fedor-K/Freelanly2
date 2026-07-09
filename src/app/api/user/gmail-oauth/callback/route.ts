import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { exchangeCode, verifyState } from '@/lib/gmail-oauth';
import { encryptToken } from '@/lib/token-crypto';

// GET /api/user/gmail-oauth/callback?code=...&state=...
// Google redirects here after consent. Store the refresh token, then bounce back to where they started.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = verifyState(params.get('state'));
  const back = (suffix: string) =>
    NextResponse.redirect(new URL(`${state?.returnPath || '/dashboard/settings'}${(state?.returnPath || '').includes('?') ? '&' : '?'}gmail=${suffix}`, request.url));

  // CSRF: state must be valid AND belong to the currently logged-in user.
  const session = await auth();
  if (!state || !session?.user?.id || session.user.id !== state.userId) {
    return back('error');
  }
  if (params.get('error')) return back('denied'); // user declined on the consent screen

  const code = params.get('code');
  if (!code) return back('error');

  const tokens = await exchangeCode(code);
  if (!tokens) return back('error');

  await prisma.gmailAuth.upsert({
    where: { userId: state.userId },
    create: {
      userId: state.userId,
      email: tokens.email || session.user.email || '',
      refreshToken: encryptToken(tokens.refreshToken),
      verified: true,
    },
    update: {
      email: tokens.email || session.user.email || '',
      refreshToken: encryptToken(tokens.refreshToken),
      verified: true,
      lastError: null,
    },
  });

  await prisma.activityLog.create({
    data: { userId: state.userId, action: 'LOGIN', details: { provider: 'gmail_oauth', scope: 'gmail.send' } },
  }).catch(() => {});

  return back('connected');
}
