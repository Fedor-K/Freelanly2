import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { isFreeEmailProvider } from '@/lib/content-quality';
import { getRecruiterPortalUrl, getRecruiterUnsubscribeUrl } from '@/lib/recruiter-token';
import { recruiterShortlistNudgeEmail } from '@/lib/email-templates';

// Once a recruiter has been nudged, don't nudge again for this long — they often reply to
// several candidates in a row, and one nudge per fortnight is plenty (cap, not per-reply).
const NUDGE_COOLDOWN_DAYS = 14;

/**
 * Lever #1 — intercept the recruiter at the moment they reply to a candidate (peak intent) and
 * pull them into the portal with the one thing the application email can't deliver: their full
 * shortlist (N candidates for this exact role). Recruiters engage ~3× more by plain email reply
 * than via the portal, so this catches the proven-responsive segment where they already are.
 *
 * Fire-and-forget and heavily guarded: skips free-mail inboxes, honors RecruiterSuppression
 * (opt-out/bounce/complaint), and rate-limits to one nudge per recruiter per cooldown window via
 * an ActivityLog marker. Safe to call from more than one inbound processor — the cooldown dedupes
 * (best-effort: a same-instant burst of replies could slip a duplicate, acceptable for a 14d cap).
 * Never throws.
 */
export async function maybeSendRecruiterShortlistNudge(args: {
  recruiterEmail: string;
  jobTitle: string;
  candidateName: string;
  applicationId: string;
  category: string;
}): Promise<void> {
  try {
    const email = (args.recruiterEmail || '').toLowerCase().trim();
    if (!email || !email.includes('@')) return;
    if (isFreeEmailProvider(email)) return; // not a hiring desk we can sell a pipeline to

    // Opted out / bounced / complained — never email again.
    const suppressed = await prisma.recruiterSuppression.findUnique({ where: { email }, select: { email: true } });
    if (suppressed) return;

    // Frequency cap: one nudge per recruiter per cooldown window.
    const since = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const recent = await prisma.activityLog.findFirst({
      where: {
        action: 'RECRUITER_PORTAL_NUDGE_SENT',
        createdAt: { gte: since },
        details: { path: ['recruiterEmail'], equals: email },
      },
      select: { id: true },
    });
    if (recent) return;

    // N = candidates for THIS exact vacancy (recruiter inbox + job title) — the shortlist hook.
    const candidateCount = await prisma.autoApplication.count({
      where: { appliedToEmail: { equals: email, mode: 'insensitive' }, jobTitle: args.jobTitle, sentAt: { not: null } },
    });

    const mail = recruiterShortlistNudgeEmail({
      candidateName: args.candidateName,
      jobTitle: args.jobTitle,
      candidateCount,
      portalUrl: getRecruiterPortalUrl(email),
      unsubscribeUrl: getRecruiterUnsubscribeUrl(email),
    });

    const res = await sendEmail({
      to: email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      listUnsubscribe: getRecruiterUnsubscribeUrl(email),
    });

    await prisma.activityLog.create({
      data: {
        action: 'RECRUITER_PORTAL_NUDGE_SENT',
        details: {
          recruiterEmail: email,
          applicationId: args.applicationId,
          jobTitle: args.jobTitle,
          candidateCount,
          category: args.category,
          ok: !!res.success,
          err: res.error || null,
        },
      },
    }).catch(() => {});

    console.log(`[RecruiterNudge] ${email} (${candidateCount} for "${args.jobTitle}") ok=${!!res.success} ${res.error || ''}`);
  } catch (e) {
    console.error('[RecruiterNudge] failed:', (e as Error)?.message);
  }
}
