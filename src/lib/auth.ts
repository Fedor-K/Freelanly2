import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import { prisma } from '@/lib/db';
import { sendMagicLinkEmail } from '@/lib/auth-email';
import { ActivityAction } from '@prisma/client';

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),

  providers: [
    // Google OAuth
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),

    // Magic Link via Email (using custom send function)
    Resend({
      from: process.env.DASHAMAIL_FROM_EMAIL || 'noreply@freelanly.com',
      // We override sendVerificationRequest to use DashaMail
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
          },
        });
        if (fullUser) {
          session.user.plan = fullUser.plan;
          session.user.jobViewsToday = fullUser.jobViewsToday;
          session.user.resumeUrl = fullUser.resumeUrl;
        }
      }
      return session;
    },

    // Allow linking accounts with same email
    async signIn({ user, account }) {
      // Allow OAuth sign in even if user exists with same email
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        if (existingUser && !existingUser.emailVerified) {
          // Mark email as verified since Google verified it
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date() },
          });
        }
      }
      return true;
    },
  },

  events: {
    // Track new signups
    async createUser({ user }) {
      console.log(`[Auth] New user created: ${user.email}`);
      // Log signup for dispute evidence (IP not available in NextAuth events)
      try {
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: ActivityAction.SIGNUP,
            details: { email: user.email },
          },
        });
      } catch (e) {
        console.error('[Auth] Failed to log signup:', e);
      }
    },

    // Set emailVerified for Google OAuth users
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

      // Verify email for Google users (Google already verified it)
      if (account?.provider === 'google' && user.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { emailVerified: true },
        });

        if (dbUser && !dbUser.emailVerified) {
          await prisma.user.update({
            where: { id: user.id },
            data: { emailVerified: new Date() },
          });
          console.log(`[Auth Event] Verified email for Google user ${user.email}`);
        }
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
