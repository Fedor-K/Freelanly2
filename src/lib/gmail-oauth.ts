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

// --- signed state (CSRF + carries userId & return path) ---
function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('hex').slice(0, 32);
}
export function signState(userId: string, returnPath: string): string {
  const payload = JSON.stringify({ u: userId, r: returnPath, e: Date.now() + STATE_TTL_MS });
  const b64 = Buffer.from(payload).toString('base64url');
  return `${b64}.${sign(b64)}`;
}
export function verifyState(state: string | null | undefined): { userId: string; returnPath: string } | null {
  if (!state || typeof state !== 'string' || !state.includes('.')) return null;
  try {
    const [b64, mac] = state.split('.');
    const expected = sign(b64);
    if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const { u, r, e } = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    if (!u || Date.now() > Number(e)) return null;
    return { userId: u, returnPath: typeof r === 'string' && r.startsWith('/') ? r : '/dashboard/settings' };
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
    scope: `openid email ${GMAIL_SEND_SCOPE}`,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  if (loginHint) p.set('login_hint', loginHint);
  return `${AUTH_ENDPOINT}?${p.toString()}`;
}

/** Exchange an authorization code for tokens. Returns refresh_token + the connected Gmail address. */
export async function exchangeCode(code: string): Promise<{ refreshToken: string; email: string | null } | null> {
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
  return { refreshToken: data.refresh_token, email: decodeIdTokenEmail(data.id_token) };
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

/** Decode the `email` claim from a Google id_token (no signature check needed — it came from Google's token endpoint over TLS). */
function decodeIdTokenEmail(idToken?: string): string | null {
  if (!idToken || typeof idToken !== 'string') return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return typeof payload.email === 'string' ? payload.email : null;
  } catch {
    return null;
  }
}
