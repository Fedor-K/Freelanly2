import { prisma } from '@/lib/db';
import { ActivityAction } from '@prisma/client';

export type SignupContext = {
  userId: string;
  email?: string | null;
  /** utm_source / referrer-derived traffic source. */
  source?: string | null;
  /** Which surface created the account: 'freelance_inline' | 'auth_signin' | 'auth_modal' | 'magic_link'. */
  entryPoint?: string | null;
  /** The project (Opportunity) the user registered through, if any. */
  opportunityId?: string | null;
  jobId?: string | null;
  /** Page path the registration happened on. */
  pageUrl?: string | null;
};

/**
 * THE single registration chokepoint. Call once per newly-created user from EVERY creation site —
 * the /api/auth/register upsert (path A: inline /freelance + auth forms) and the NextAuth adapter
 * createUser event (path B: magic-link with no pre-register). Writes one SIGNUP ActivityLog row
 * carrying the real userId + full attribution, so "where/how do users register" is finally
 * answerable from a single source of truth instead of a dozen unattributed surfaces.
 *
 * Idempotent: a user that already has a SIGNUP row is skipped, so the two call sites can never
 * double-count (and a retried register is safe). Never throws — attribution must not break signup.
 */
export async function recordSignup(ctx: SignupContext): Promise<void> {
  try {
    const existing = await prisma.activityLog.findFirst({
      where: { userId: ctx.userId, action: ActivityAction.SIGNUP },
      select: { id: true },
    });
    if (existing) return;

    await prisma.activityLog.create({
      data: {
        userId: ctx.userId,
        action: ActivityAction.SIGNUP,
        pageUrl: ctx.pageUrl || null,
        details: {
          email: ctx.email || null,
          source: ctx.source || null,
          entryPoint: ctx.entryPoint || 'unknown',
          opportunityId: ctx.opportunityId || null,
          jobId: ctx.jobId || null,
        },
      },
    });
  } catch (e) {
    console.error('[recordSignup] failed:', (e as Error)?.message);
  }
}
