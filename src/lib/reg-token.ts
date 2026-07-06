import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

// Short-lived signed proof that an email JUST passed OTP verification, handed from verify-code to
// resume-preauth so the résumé-upload step can create the session (deferred until the profile is
// complete) WITHOUT re-opening an OTP bypass: resume-preauth IDs users by email alone, so it must
// never mint a session for an email that hasn't proven a fresh OTP. HMAC(email:expiry) with AUTH_SECRET.
const SECRET = process.env.AUTH_SECRET || randomBytes(32).toString('hex');
const TTL_MS = 30 * 60 * 1000; // 30 min — long enough to fill the profile form, short enough to be safe

function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('hex').slice(0, 32);
}

/** Issue a registration token proving `email` just verified its OTP. */
export function signRegToken(email: string): string {
  const payload = `${email.toLowerCase().trim()}:${Date.now() + TTL_MS}`;
  const b64 = Buffer.from(payload).toString('base64url');
  return `${b64}.${sign(payload)}`;
}

/** Verify a registration token; returns the email if valid + unexpired, else null. */
export function verifyRegToken(token: string | null | undefined): string | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  try {
    const [b64, mac] = token.split('.');
    const payload = Buffer.from(b64, 'base64url').toString('utf8');
    const expected = sign(payload);
    if (mac.length !== expected.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
    const [email, expiryStr] = payload.split(':');
    if (!email || !expiryStr) return null;
    if (Date.now() > Number(expiryStr)) return null;
    return email;
  } catch {
    return null;
  }
}
