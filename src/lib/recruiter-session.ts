import { cookies } from 'next/headers';
import { signRecruiterToken, verifyRecruiterToken } from '@/lib/recruiter-token';

// Recruiter session = an httpOnly cookie holding the SAME signed HMAC token used by /r/<token>.
// This reuses the existing portal auth wholesale: a logged-in recruiter just gets redirected into
// their /r/<token> page. No NextAuth, no parallel session store.
const COOKIE = 'recruiter_session';
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

export async function setRecruiterSession(email: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, signRecruiterToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
}

/** Returns the recruiter email from the session cookie, or null. */
export async function getRecruiterSession(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  return token ? verifyRecruiterToken(token) : null;
}

export async function clearRecruiterSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}
