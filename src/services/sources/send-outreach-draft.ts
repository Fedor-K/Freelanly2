// Send ONE stored OutreachDraft from the admin send desk (founder clicks "Send now"). Unlike the
// dormant auto-cron (sendCompanyCard), this is a deliberate manual action, so it skips the warm-up
// cap/cooldown/master-switch — but it STILL honors suppression (never email an opt-out/bounce) and
// sends from the isolated outreach domain (OUTREACH.fromEmail), logging COMPANY_CARD_SENT so the
// deliverability kill-switch keeps seeing volume. On success it persists the shortlist as SHORTLIST
// AutoApplication rows so the email's "View profiles & CVs" portal link actually resolves.
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email';
import { getRecruiterUnsubscribeUrl } from '@/lib/recruiter-token';
import { OUTREACH } from './recruiter-outreach';

export type SendDraftResult = { sent: boolean; from?: string; reason?: string; messageId?: string };

export type StoredCandidate = { userId: string; label: string | null };

export async function sendOutreachDraft(id: string): Promise<SendDraftResult> {
  const d = await prisma.outreachDraft.findUnique({ where: { id } });
  if (!d) return { sent: false, reason: 'not found' };
  if (d.status === 'SENT') return { sent: false, reason: 'already sent' };

  const to = d.contactEmail.toLowerCase().trim();
  if (!to.includes('@')) return { sent: false, reason: 'bad email' };

  // Suppression is the ONE hard gate a manual send still respects.
  try {
    const sup = await prisma.recruiterSuppression.findUnique({ where: { email: to }, select: { email: true } });
    if (sup) return { sent: false, reason: 'suppressed (opted out / bounced)' };
  } catch { return { sent: false, reason: 'suppression check failed' }; }

  const from = OUTREACH.fromEmail;
  let res: { success: boolean; messageId?: string; error?: string };
  try {
    res = await sendEmail({
      to, from, fromName: 'Freelanly Talent',
      subject: d.subject, html: d.bodyHtml, text: d.bodyText,
      listUnsubscribe: getRecruiterUnsubscribeUrl(to),
    });
  } catch (e) { res = { success: false, error: (e as Error)?.message }; }

  if (!res.success) return { sent: false, from, reason: `send failed: ${res.error || 'unknown'}` };

  // Mark sent + log for the health machinery.
  await prisma.outreachDraft.update({ where: { id }, data: { status: 'SENT', sentAt: new Date() } }).catch(() => {});
  await prisma.activityLog.create({
    data: { action: 'COMPANY_CARD_SENT', details: { domain: d.contactDomain, email: to, role: d.roleTitle, company: d.companyName || d.contactDomain, candidateCount: d.candidateCount, ok: true, messageId: res.messageId || null, source: 'admin_send_desk' } },
  }).catch(() => {});

  // Persist the shortlist so the email's portal link shows these candidates (profiles + CVs + reply).
  await persistDraftCandidates(to, d.companyName || d.contactDomain.split('.')[0], d.roleTitle, (d.candidates as unknown as StoredCandidate[]) || []);

  return { sent: true, from, messageId: res.messageId };
}

/** Persist a draft's shortlist as SHORTLIST AutoApplication rows so the recruiter landing (which reads
 *  AutoApplication) shows them. Called at BUILD time (so a draft's landing is populated before send)
 *  and on send. Idempotent per (candidate, recruiter, role). Never throws on a single candidate. */
export async function persistDraftCandidates(email: string, company: string, role: string, cands: StoredCandidate[]): Promise<void> {
  for (const c of cands) {
    if (!c?.userId) continue;
    try {
      const existing = await prisma.autoApplication.findFirst({
        where: { userId: c.userId, appliedToEmail: email, jobTitle: role, origin: 'SHORTLIST' }, select: { id: true },
      });
      if (existing) continue;
      const loop = await prisma.autoApplyLoop.findFirst({ where: { userId: c.userId }, select: { id: true } });
      if (!loop) continue;
      await prisma.autoApplication.create({
        data: {
          userId: c.userId, loopId: loop.id, appliedToEmail: email, companyName: company, jobTitle: role,
          coverLetter: '', subject: '', origin: 'SHORTLIST', status: 'SENT', matchLabel: c.label ?? null,
        },
      });
    } catch { /* one candidate failing must not block the send record */ }
  }
}
