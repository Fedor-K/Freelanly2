import { prisma } from '@/lib/db';
import { OUTREACH } from '@/services/sources/recruiter-outreach';
import { OutreachClient, type DraftView } from './OutreachClient';

export const dynamic = 'force-dynamic';

/**
 * /admin/recruiter-outreach — the demand-side send desk.
 *
 * Lists ready-to-send candidate-pitch emails (one per ATS company + role), built by the Lever
 * pipeline into OutreachDraft. The founder reviews each, copies it, and sends from his own inbox,
 * then marks it sent. No auto-send here — this page only reads/organizes drafts.
 *
 * Data is produced by the build-outreach cron on the Hetzner worker (port 25 → verified contacts).
 * Admin-guarded by /admin/layout.tsx.
 */
export default async function RecruiterOutreachPage() {
  const [rows, grouped] = await Promise.all([
    prisma.outreachDraft.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 300,
    }),
    prisma.outreachDraft.groupBy({ by: ['status'], _count: true }),
  ]);

  const counts = { DRAFT: 0, SENT: 0, SKIPPED: 0 } as Record<string, number>;
  for (const g of grouped) counts[g.status] = g._count;

  const drafts: DraftView[] = rows.map((r) => ({
    id: r.id,
    companyName: r.companyName || r.contactDomain.split('.')[0],
    contactEmail: r.contactEmail,
    contactDomain: r.contactDomain,
    contactMethod: r.contactMethod,
    roleTitle: r.roleTitle,
    roleUrl: r.roleUrl,
    subject: r.subject,
    bodyHtml: r.bodyHtml,
    bodyText: r.bodyText,
    candidateCount: r.candidateCount,
    candidates: (r.candidates as unknown as DraftView['candidates']) || [],
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div style={{ padding: '24px', maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Recruiter outreach</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 20 }}>
        Ready-to-send candidate pitches, one per ATS company + open role. Review, copy, send from your own inbox, then mark sent.
        Contacts marked <strong>guess</strong> are unverified <code>careers@</code> — eyeball before sending.
      </p>
      <OutreachClient drafts={drafts} counts={counts} fromEmail={OUTREACH.fromEmail} />
    </div>
  );
}
