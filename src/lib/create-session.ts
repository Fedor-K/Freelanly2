import { prisma } from '@/lib/db';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

/** Create a 30-day NextAuth-compatible DB session for `userId` and set the session cookie. Shared by
 *  verify-code (returning users) and resume-preauth (new users, once their profile is complete). */
export async function createUserSession(userId: string): Promise<void> {
  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { sessionToken, userId, expires } });

  const cookieStore = await cookies();
  const isSecure = process.env.NODE_ENV === 'production';
  const cookieName = isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token';
  cookieStore.set(cookieName, sessionToken, {
    expires, httpOnly: true, secure: isSecure, sameSite: 'lax', path: '/',
  });
}
