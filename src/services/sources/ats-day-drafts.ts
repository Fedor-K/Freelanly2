// Build outreach drafts from TODAY's ATS (Lever) opportunity flow — the strict view Fedor wants on
// /admin/recruiter-outreach: every ATS vacancy ingested today that passes BOTH gates (a resolvable
// company contact AND a strong vetted shortlist) becomes a sendable draft linked to its Opportunity.
//
// Unlike buildOutreachDrafts (which scans random Lever COMPANY boards), this iterates the specific
// ROLES already ingested today (source='ats_lever'), so the page mirrors the day's real ATS inflow.
//
// ⚠️ Same execution constraint as the scan build: resolveCompanyContact wants port 25 for a verified
// contact (Hetzner); elsewhere set CONTACT_PROBE_ENABLED=false → careers@ guess. Needs a live AI key
// (the gate fails CLOSED). Never throws on a single opportunity.
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { resolveCompanyContact } from './company-contact';
import { buildShortlistForRole, type ShortlistCandidate } from '@/services/recruiter-shortlist';
import { cardEmail, normalizeProfession } from './recruiter-outreach';
import { persistDraftCandidates } from './send-outreach-draft';
import { getRecruiterPortalUrl, getRecruiterUnsubscribeUrl } from '@/lib/recruiter-token';
import type { LeverPosting } from './lever-ats';

export type AtsDayResult = {
  vacancies: number;   // today's ATS opportunities considered
  noContact: number;   // dropped: no resolvable company contact
  noCandidates: number;// dropped: no candidate cleared the strong-shortlist floor
  created: number;     // drafts persisted
  existing: number;    // already drafted for this opportunity (skipped)
};

const leverSlug = (applyUrl: string | null): string | null => {
  const m = (applyUrl || '').match(/jobs\.lever\.co\/([^/?#]+)/i);
  return m ? m[1].toLowerCase().trim() : null;
};

function pickCandidate(c: ShortlistCandidate) {
  return { userId: c.userId, name: c.name, profession: normalizeProfession(c.title), location: c.location || 'Remote', label: c.label ?? null, email: c.email };
}

/** Reconstruct the minimal LeverPosting shape buildShortlistForRole reads (title/description/country). */
function toRole(o: { title: string; description: string | null; country: string | null; location: string | null; applyUrl: string | null; sourceId: string | null; createdAt: Date }, slug: string): LeverPosting {
  return {
    sourceId: o.sourceId || '', source: 'lever', companySlug: slug, title: o.title,
    location: o.location, country: o.country, workplaceType: null, commitment: null, team: null,
    salary: null, descriptionPlain: o.description || '', requirements: [],
    applyUrl: o.applyUrl || '', hostedUrl: o.applyUrl || '', createdAt: o.createdAt,
  };
}

/** MSK-day [start, end) window in UTC for `day` ('YYYY-MM-DD'), or today's MSK day if omitted. */
export async function mskDayBounds(day?: string): Promise<{ a: Date; b: Date }> {
  const r = day
    ? await prisma.$queryRawUnsafe<{ a: Date; b: Date }[]>(
        `SELECT ($1::date::timestamp AT TIME ZONE 'Europe/Moscow') a, (($1::date + 1)::timestamp AT TIME ZONE 'Europe/Moscow') b`, day)
    : await prisma.$queryRawUnsafe<{ a: Date; b: Date }[]>(
        `SELECT (date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow') a,
                (date_trunc('day', now() AT TIME ZONE 'Europe/Moscow') AT TIME ZONE 'Europe/Moscow' + interval '1 day') b`);
  return r[0];
}

export async function buildAtsDayDrafts(opts: { day?: string } = {}): Promise<AtsDayResult> {
  const { a, b } = await mskDayBounds(opts.day);

  const opps = await prisma.opportunity.findMany({
    where: { source: 'ats_lever', isActive: true, createdAt: { gte: a, lt: b } },
    select: { id: true, title: true, description: true, country: true, location: true, applyUrl: true, sourceId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const out: AtsDayResult = { vacancies: opps.length, noContact: 0, noCandidates: 0, created: 0, existing: 0 };

  for (const o of opps) {
    const already = await prisma.outreachDraft.findUnique({ where: { opportunityId: o.id }, select: { id: true } }).catch(() => null);
    if (already) { out.existing++; continue; }

    const slug = leverSlug(o.applyUrl);
    if (!slug) { out.noContact++; continue; }

    const contact = await resolveCompanyContact({ slug, name: null });
    if (!contact.email) { out.noContact++; continue; }   // strict: must have a contact

    let shortlist: ShortlistCandidate[] = [];
    // allowWeak: demand-side pitch shows best-available (recruiter decides) — includes Weak-labelled
    // fits, still decision=SEND + ≥1 matched requirement. Strict Strong/Good-only produced 0 pitches.
    try { shortlist = await buildShortlistForRole(toRole(o, slug), { limit: 3, allowWeak: true }); } catch { shortlist = []; }
    if (!shortlist.length) { out.noCandidates++; continue; } // strict: must have a strong shortlist

    const company = contact.domain.split('.')[0];
    const companyName = company.charAt(0).toUpperCase() + company.slice(1);
    const mail = cardEmail(companyName, o.title, shortlist, getRecruiterPortalUrl(contact.email), getRecruiterUnsubscribeUrl(contact.email));

    try {
      await prisma.outreachDraft.create({
        data: {
          opportunityId: o.id, companySlug: slug, companyName,
          contactEmail: contact.email, contactDomain: contact.domain, contactMethod: contact.method,
          roleTitle: o.title, roleUrl: o.applyUrl, location: o.location,
          subject: mail.subject, bodyHtml: mail.html, bodyText: mail.text,
          candidates: shortlist.map(pickCandidate) as unknown as Prisma.InputJsonValue,
          candidateCount: shortlist.length,
        },
      });
      // Populate the recruiter landing now (reads AutoApplication), so the draft's /r link isn't empty
      // before it's sent.
      await persistDraftCandidates(contact.email, companyName, o.title, shortlist.map((c) => ({ userId: c.userId, label: c.label ?? null, matchBreakdown: c.matchBreakdown ?? null })));
      out.created++;
    } catch { out.existing++; }
  }
  return out;
}
