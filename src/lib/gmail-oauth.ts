import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { siteConfig } from '@/config/site';

// Google OAuth for the `gmail.send` scope — so users send job applications from their OWN Gmail via the
// Gmail API (users.messages.send), no app password. We manage the grant ourselves (NextAuth here is
// email-only), reusing the project's Google OAuth Web client credentials.

export const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

const SECRET = process.env.AUTH_SECRET || randomBytes(32).toString('hex');
const STATE_TTL_MS = 15 * 60 * 1000; // 15 min to complete the consent flow

export function googleClient(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function redirectUri(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || siteConfig.url;
  return `${base.replace(/\/$/, '')}/api/user/gmail-oauth/callback`;
}

// --- signed state (CSRF + carries userId OR signup flag & return path) ---
function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('hex').slice(0, 32);
}
/** Connect mode: pass the session userId. Signup mode: userId=null + signup=true — the callback will
 *  find-or-create the user from Google's id_token (verified email) and mint the session itself. */
export function signState(userId: string | null, returnPath: string, signup = false): string {
  const payload = JSON.stringify({ u: userId || '', s: signup ? 1 : 0, r: returnPath, e: Date.now() + STATE_TTL_MS });
  const b64 = Buffer.from(payload).toString('base64url');
  return `${b64}.${sign(b64)}`;
}
export function verifyState(state: string | null | undefined): { userId: string | null; signup: boolean; returnPath: string } | null {
  if (!state || typeof state !== 'string' || !state.includes('.')) return null;
  try {
    const [b64, mac] = state.split('.');
    const expected = sign(b64);
    if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const { u, s, r, e } = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (Date.now() > Number(e)) return null;
    if (!u && s !== 1) return null; // must be either a connect (userId) or an explicit signup
    return { userId: u || null, signup: s === 1, returnPath: typeof r === 'string' && r.startsWith('/') ? r : '/dashboard/settings' };
  } catch {
    return null;
  }
}

/** Build the Google consent URL. `access_type=offline` + `prompt=consent` force a durable refresh_token. */
export function buildAuthUrl(state: string, loginHint?: string): string | null {
  const client = googleClient();
  if (!client) return null;
  const p = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: redirectUri(),
    response_type: 'code',
    // `profile` gives us the user's name in the id_token — needed by signup mode to create the account.
    scope: `openid email profile ${GMAIL_SEND_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  if (loginHint) p.set('login_hint', loginHint);
  return `${AUTH_ENDPOINT}?${p.toString()}`;
}

/** Exchange an authorization code for tokens. Returns refresh_token + the Google identity (email must
 *  be verified by Google before signup mode may trust it). */
export async function exchangeCode(code: string): Promise<{ refreshToken: string; email: string | null; emailVerified: boolean; name: string | null; canSend: boolean } | null> {
  const client = googleClient();
  if (!client) return null;
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.refresh_token) return null; // prompt=consent should always return one
  const id = decodeIdToken(data.id_token);
  // Google returns the ACTUALLY-granted scopes (space-separated). A user can complete Google sign-in
  // while UNCHECKING the "send email on your behalf" box → we get identity but NOT gmail.send. If we
  // don't check this, we mark the grant sendable and every send later 403s "insufficient scopes".
  const canSend = typeof data.scope === 'string' && data.scope.split(/\s+/).includes(GMAIL_SEND_SCOPE);
  return { refreshToken: data.refresh_token, email: id.email, emailVerified: id.emailVerified, name: id.name, canSend };
}

/** Refresh an access token from a stored refresh token (used by the send path). */
export async function accessTokenFromRefresh(refreshToken: string): Promise<string | null> {
  const client = googleClient();
  if (!client) return null;
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: client.clientId,
      client_secret: client.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  return data?.access_token || null;
}

/** Decode identity claims from a Google id_token (no signature check needed — it came straight from
 *  Google's token endpoint over TLS, not from the browser). */
function decodeIdToken(idToken?: string): { email: string | null; emailVerified: boolean; name: string | null } {
  if (!idToken || typeof idToken !== 'string') return { email: null, emailVerified: false, name: null };
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return {
      email: typeof payload.email === 'string' ? payload.email : null,
      emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      name: typeof payload.name === 'string' ? payload.name : null,
    };
  } catch {
    return { email: null, emailVerified: false, name: null };
  }
}
