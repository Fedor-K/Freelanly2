// Demand-side draft builder: run the dormant Lever pipeline and PERSIST a ready-to-send candidate
// pitch per (company, role) into OutreachDraft, so the founder can review + send them manually from
// /admin/recruiter-outreach — no auto-send (that stays gated in recruiter-outreach.ts).
//
//   buildLeverCompanyCards (company + target roles + contact)  →  buildShortlistForRole (3 vetted
//   candidates)  →  cardEmail (subject/html/text)  →  upsert OutreachDraft (idempotent per domain+role).
//
// ⚠️ Heavy + Hetzner-oriented: fetches many Lever boards (rate-limited) and, for the best contact
// quality, wants port-25 (resolveCompanyContact). On a host without port 25, set
// CONTACT_PROBE_ENABLED=false and it still drafts using a careers@ guess (unverified — the founder
// eyeballs the recipient before sending). Never throws on a single company.
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { buildLeverCompanyCards } from './lever-pipeline';
import { buildShortlistForRole, type ShortlistCandidate } from '@/services/recruiter-shortlist';
import { cardEmail, normalizeProfession } from './recruiter-outreach';
import { getRecruiterPortalUrl, getRecruiterUnsubscribeUrl } from '@/lib/recruiter-token';

export type BuildDraftsResult = {
  companies: number;    // cards with a target role + contact
  created: number;      // new drafts persisted
  existing: number;     // company+role already drafted (skipped, not overwritten)
  noCandidates: number; // no candidate cleared the shortlist quality floor
};

/** Compact candidate shape stored on the draft for the admin table (real name is admin-only; the
 *  email itself stays anonymous via cardEmail). */
function pickCandidate(c: ShortlistCandidate) {
  return {
    userId: c.userId,
    name: c.name,
    profession: normalizeProfession(c.title),
    location: c.location || 'Remote',
    label: c.label ?? null,
    email: c.email,
  };
}

export async function buildOutreachDrafts(opts: { limit?: number } = {}): Promise<BuildDraftsResult> {
  const cards = await buildLeverCompanyCards({ limit: opts.limit ?? 2060, requireContact: true });
  const out: BuildDraftsResult = { companies: cards.length, created: 0, existing: 0, noCandidates: 0 };

  for (const card of cards) {
    const role = card.roles[0];
    if (!role || !card.contact.email) continue;

    // Skip early if this company+role is already drafted (don't pay the LLM shortlist again).
    const already = await prisma.outreachDraft.findUnique({
      where: { contactDomain_roleTitle: { contactDomain: card.contact.domain, roleTitle: role.title } },
      select: { id: true },
    }).catch(() => null);
    if (already) { out.existing++; continue; }

    let shortlist: ShortlistCandidate[] = [];
    try { shortlist = await buildShortlistForRole(role, { limit: 3 }); } catch { shortlist = []; }
    if (!shortlist.length) { out.noCandidates++; continue; }

    const company = card.name || card.contact.domain.split('.')[0];
    const mail = cardEmail(
      company, role.title, shortlist,
      getRecruiterPortalUrl(card.contact.email), getRecruiterUnsubscribeUrl(card.contact.email),
    );

    try {
      await prisma.outreachDraft.create({
        data: {
          companySlug: card.slug,
          companyName: card.name,
          contactEmail: card.contact.email,
          contactDomain: card.contact.domain,
          contactMethod: card.contact.method,
          roleTitle: role.title,
          roleUrl: role.hostedUrl || null,
          subject: mail.subject,
          bodyHtml: mail.html,
          bodyText: mail.text,
          candidates: shortlist.map(pickCandidate) as unknown as Prisma.InputJsonValue,
          candidateCount: shortlist.length,
        },
      });
      out.created++;
    } catch {
      // Unique race (domain+role) or transient — count as existing, keep going.
      out.existing++;
    }
  }
  return out;
}
