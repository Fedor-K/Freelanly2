import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { exchangeCode, verifyState } from '@/lib/gmail-oauth';
import { encryptToken } from '@/lib/token-crypto';
import { createUserSession } from '@/lib/create-session';

// GET /api/user/gmail-oauth/callback?code=...&state=...
// Google redirects here after consent. Two modes (see start/route.ts):
// - CONNECT: store the send grant on the session user.
// - SIGNUP: find-or-create the user from Google's VERIFIED email, mint the session (same
//   createUserSession as verify-code/resume-preauth), store the grant — registration in one click.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = verifyState(params.get('state'));
  const back = (suffix: string) =>
    NextResponse.redirect(new URL(`${state?.returnPath || '/dashboard/settings'}${(state?.returnPath || '').includes('?') ? '&' : '?'}gmail=${suffix}`, request.url));

  if (!state) return back('error');
  if (params.get('error')) return back('denied'); // user declined on the consent screen

  const code = params.get('code');
  if (!code) return back('error');

  // Resolve WHO this grant belongs to.
  let userId: string;
  let tokens: Awaited<ReturnType<typeof exchangeCode>>;

  if (state.signup) {
    tokens = await exchangeCode(code);
    if (!tokens) return back('error');
    // Trust the email ONLY if Google says it's verified — it's about to become a login identity.
    if (!tokens.email || !tokens.emailVerified) return back('error');
    const email = tokens.email.toLowerCase().trim();
    const user = await prisma.user.upsert({
      where: { email },
      // Existing account (registered earlier via OTP): this doubles as LOGIN — verify email if needed,
      // fill the name if missing, and link the send grant below.
      update: { emailVerified: new Date() },
      create: { email, name: tokens.name, emailVerified: new Date() },
      select: { id: true, name: true },
    });
    if (!user.name && tokens.name) {
      await prisma.user.update({ where: { id: user.id }, data: { name: tokens.name } }).catch(() => {});
    }
    userId = user.id;
    await createUserSession(userId);
    await prisma.activityLog.create({
      data: { userId, action: 'LOGIN', details: { provider: 'google_signup', scope: 'gmail.send' } },
    }).catch(() => {});
  } else {
    // CONNECT: state must belong to the currently logged-in user (CSRF).
    const session = await auth();
    if (!session?.user?.id || session.user.id !== state.userId) return back('error');
    tokens = await exchangeCode(code);
    if (!tokens) return back('error');
    userId = session.user.id;
    await prisma.activityLog.create({
      data: { userId, action: 'LOGIN', details: { provider: 'gmail_oauth', scope: 'gmail.send' } },
    }).catch(() => {});
  }

  // verified = the grant can actually SEND. If the user completed Google sign-in but declined the
  // "send email" permission, tokens.canSend is false → store the identity grant but mark it NOT
  // sendable (verified=false), so the send path routes to Postal instead of 403-ing forever.
  await prisma.gmailAuth.upsert({
    where: { userId },
    create: {
      userId,
      email: tokens.email || '',
      refreshToken: encryptToken(tokens.refreshToken),
      verified: tokens.canSend,
      lastError: tokens.canSend ? null : 'gmail.send permission not granted',
    },
    update: {
      email: tokens.email || '',
      refreshToken: encryptToken(tokens.refreshToken),
      verified: tokens.canSend,
      lastError: tokens.canSend ? null : 'gmail.send permission not granted',
    },
  });

  // Always return 'connected' — the user IS signed in either way; the flow must proceed normally.
  // When gmail.send was declined we stored verified=false above, so sends auto-route to Postal
  // instead of 403-ing. (A "reconnect to send from your own Gmail" nudge can come later.)
  return back('connected');
}
