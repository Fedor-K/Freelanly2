import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

const FROM = process.env.EMAIL_FROM || 'IntentPond <info@freelanly.com>';
const POSTAL_URL = (process.env.POSTAL_API_URL || 'https://postal.freelanly.com').trim();

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    {
      id: 'email',
      type: 'email',
      name: 'Email',
      from: FROM,
      maxAge: 24 * 60 * 60,
      options: {},
      async sendVerificationRequest({ identifier, url }: { identifier: string; url: string }) {
        const html = `<div style="font-family:sans-serif;max-width:480px">
          <h2 style="color:#0b0f17">Sign in to IntentPond</h2>
          <p>Click the button to sign in. This link expires in 24 hours.</p>
          <p><a href="${url}" style="background:#2bd576;color:#06210f;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Sign in →</a></p>
          <p style="color:#888;font-size:13px">Or paste this link: ${url}</p></div>`;
        const res = await fetch(`${POSTAL_URL}/api/v1/send/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Server-API-Key': process.env.POSTAL_API_KEY || '' },
          body: JSON.stringify({ to: [identifier], from: FROM, subject: 'Sign in to IntentPond', html_body: html, plain_body: `Sign in to IntentPond: ${url}` }),
        });
        if (!res.ok) throw new Error('Postal send failed: ' + res.status + ' ' + (await res.text()).slice(0, 120));
      },
    } as any,
  ],
  pages: { signIn: '/login' },
});
