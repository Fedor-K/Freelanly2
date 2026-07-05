import { prisma } from '@/lib/db';
import { OUTREACH } from '@/services/sources/recruiter-outreach';
import { mskDayBounds } from '@/services/sources/ats-day-drafts';
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
export default async function RecruiterOutreachPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(sp?.date || '') ? sp!.date! : undefined;

  // Selected MSK-day (default today) ATS opportunities → their passing drafts.
  const { a, b } = await mskDayBounds(selectedDate);
  const dayOpps = await prisma.opportunity.findMany({
    where: { source: 'ats_lever', isActive: true, createdAt: { gte: a, lt: b } },
    select: { id: true },
  });
  const oppIds = dayOpps.map((o) => o.id);

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

  const vacanciesDay = dayOpps.length;
  const passed = rows.length;
  const dayLabel = selectedDate || new Date(a).toISOString().slice(0, 10);

  return (
    <div style={{ padding: '24px', maxWidth: 980, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>ATS outreach</h1>
      <p style={{ color: '#666', fontSize: 14, marginBottom: 12 }}>
        A day&apos;s ATS (Lever) vacancies that passed both gates — <strong>resolvable contact</strong> and a{' '}
        <strong>strong vetted shortlist</strong> — as ready-to-send pitches. Send from <code>{OUTREACH.fromEmail}</code> or copy, then mark sent.
      </p>
      <form method="get" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: '#555' }}>Day (MSK):</label>
        <input type="date" name="date" defaultValue={dayLabel} style={{ padding: '5px 8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }} />
        <button type="submit" style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #111', background: '#111', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>View</button>
      </form>
      <div style={{ display: 'flex', gap: 16, padding: '10px 16px', marginBottom: 20, borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb', fontSize: 13, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700 }}>{dayLabel}</span>
        <span style={{ color: '#cbd5e1' }}>|</span>
        <span><strong style={{ fontSize: 16 }}>{vacanciesDay}</strong> ATS vacancies</span>
        <span style={{ color: '#cbd5e1' }}>→</span>
        <span><strong style={{ fontSize: 16, color: '#16a34a' }}>{passed}</strong> passed (contact + shortlist)</span>
      </div>
      <OutreachClient drafts={drafts} counts={counts} fromEmail={OUTREACH.fromEmail} />
    </div>
  );
}
