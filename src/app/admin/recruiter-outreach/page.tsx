import { prisma } from '@/lib/db';
import { OUTREACH } from '@/services/sources/recruiter-outreach';
import { OutreachClient, type DraftView } from './OutreachClient';

export const dynamic = 'force-dynamic';

/**
 * /admin/recruiter-outreach — today's ATS send desk.
 *
 * Shows TODAY's ATS (ats_lever) vacancy inflow that cleared BOTH strict gates — a resolvable company
 * contact AND a strong vetted shortlist — as ready-to-send candidate pitches linked to their
 * Opportunity. Review, send (from talent.freelanly.com) or copy, then mark sent. No auto-send.
 *
 * Data is produced by the build-ats-outreach cron on the Hetzner worker (port 25 → verified
 * contacts). Admin-guarded by /admin/layout.tsx.
 */
export default async function RecruiterOutreachPage() {
  // Today (MSK) ATS opportunities → their passing drafts.
  const T0 = (await prisma.$queryRawUnsafe<{ d: Date }[]>(
    `SELECT (date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow') d`))[0].d;
  const todayOpps = await prisma.opportunity.findMany({
    where: { source: 'ats_lever', isActive: true, createdAt: { gte: T0 } },
    select: { id: true },
  });
  const oppIds = todayOpps.map((o) => o.id);

  const rows = oppIds.length
    ? await prisma.outreachDraft.findMany({
        where: { opportunityId: { in: oppIds } },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      })
    : [];

  const counts = { DRAFT: 0, SENT: 0, SKIPPED: 0 } as Record<string, number>;
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;

  const drafts: DraftView[] = rows.map((r) => ({
    id: r.id,
    companyName: r.companyName || r.contactDomain.split('.')[0],
    contactEmail: r.contactEmail,
    contactDomain: r.contactDomain,
    contactMethod: r.contactMethod,
    roleTitle: r.roleTitle,
    roleUrl: r.roleUrl,
    location: r.location,
    subject: r.subject,
    bodyHtml: r.bodyHtml,
    bodyText: r.bodyText,
    candidateCount: r.candidateCount,
    candidates: (r.candidates as unknown as DraftView['candidates']) || [],
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));

  const vacanciesToday = todayOpps.length;
  const passed = rows.length;

  return (
    <div style={{ padding: '24px', maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Today&apos;s ATS outreach</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>
        Today&apos;s ATS (Lever) vacancies that passed both gates — <strong>resolvable contact</strong> and a{' '}
        <strong>strong vetted shortlist</strong> — as ready-to-send pitches. Send from <code>{OUTREACH.fromEmail}</code> or copy, then mark sent.
      </p>
      <div style={{ display: 'inline-flex', gap: 16, padding: '10px 16px', marginBottom: 20, borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb', fontSize: 13 }}>
        <span><strong style={{ fontSize: 16 }}>{vacanciesToday}</strong> ATS vacancies today</span>
        <span style={{ color: '#cbd5e1' }}>→</span>
        <span><strong style={{ fontSize: 16, color: '#16a34a' }}>{passed}</strong> passed (contact + shortlist)</span>
      </div>
      <OutreachClient drafts={drafts} counts={counts} fromEmail={OUTREACH.fromEmail} />
    </div>
  );
}
