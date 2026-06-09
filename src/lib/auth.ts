import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Resend from 'next-auth/providers/resend';
import { prisma } from '@/lib/db';
import { sendMagicLinkEmail } from '@/lib/auth-email';
import { ActivityAction } from '@prisma/client';
import { recordSignup } from '@/lib/signup';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    // Google OAuth removed — all sign-up now goes through email (which requires résumé + LinkedIn).
    // Magic Link via Email — uses Resend provider shell but actual sending
    // goes through our email system (Elastic Email / SMTP2GO / etc.)
    // via the sendVerificationRequest override. The apiKey is a dummy value
    // since we never use Resend's API directly.
    Resend({
      apiKey: process.env.RESEND_API_KEY || 're_dummy_key_not_used',
      from: process.env.RESEND_FROM_EMAIL || 'noreply@freelanly.com',
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
  ],

  pages: {
    signIn: '/auth/signin',
    verifyRequest: '/auth/verify-request',
    error: '/auth/error',
  },

  callbacks: {
    // Add user ID and plan to session
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        // Fetch full user data with plan
        const fullUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            plan: true,
            jobViewsToday: true,
            lastViewReset: true,
            resumeUrl: true,
            lastActiveAt: true,
          },
        });
        if (fullUser) {
          session.user.plan = fullUser.plan;
          session.user.jobViewsToday = fullUser.jobViewsToday;
          session.user.resumeUrl = fullUser.resumeUrl;

          // Throttled lastActiveAt update (fire-and-forget, max once per hour)
          const now = new Date();
          const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
          if (!fullUser.lastActiveAt || fullUser.lastActiveAt < oneHourAgo) {
            prisma.user.update({
              where: { id: user.id },
              data: { lastActiveAt: now },
            }).catch(() => {});

            // Reactivate alerts if user was inactive 20+ days (alerts were auto-deactivated)
            const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
            if (!fullUser.lastActiveAt || fullUser.lastActiveAt < twentyDaysAgo) {
              prisma.jobAlert.updateMany({
                where: { userId: user.id, isActive: false },
                data: { isActive: true },
              }).then(r => {
                if (r.count > 0) console.log(`[Auth] Reactivated ${r.count} alerts for returning user ${user.id}`);
              }).catch(() => {});
            }
          }
        }
      }
      return session;
    },

    async signIn() {
      return true;
    },
  },

  events: {
    // Track new signups
    async createUser({ user }) {
      console.log(`[Auth] New user created: ${user.email}`);
      // Single registration chokepoint (path B: adapter-created users, e.g. magic-link with no
      // pre-register via /api/auth/register). Path A (register upsert) logs its own SIGNUP with
      // richer attribution; recordSignup is idempotent so this never double-logs.
      if (user.id) await recordSignup({ userId: user.id, email: user.email, entryPoint: 'magic_link' });
    },

    async signIn({ user, account }) {
      console.log(`[Auth Event] signIn: provider=${account?.provider}, email=${user.email}, userId=${user.id}`);

      // Log login for dispute evidence
      try {
        await prisma.activityLog.create({
          data: {
            userId: user.id || undefined,
            action: ActivityAction.LOGIN,
            details: { provider: account?.provider, email: user.email },
          },
        });
      } catch (e) {
        console.error('[Auth] Failed to log login:', e);
      }

    },
  },

  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  // Trust the host in production (for reverse proxies)
  trustHost: true,

  debug: process.env.NODE_ENV === 'development',
});

// Type augmentation for session
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      plan: 'FREE' | 'PRO' | 'ENTERPRISE';
      jobViewsToday: number;
      resumeUrl?: string | null;
    };
  }
}
