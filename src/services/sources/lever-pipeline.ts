// Lever pipeline glue — ties the demand-side blocks together:
//   getLeverSlugs (DataSource)  →  fetchLeverPostings  →  keep target professions (shouldSkipJob)
//   →  resolveCompanyContact (real domain + verified alias, cached, FREE)  →  one card per company.
// The output (company + its open target roles + a contact email) is what block 4 sends, and what
// buildShortlistForRole consumes to attach 3 vetted candidates per role.
//
// ⚠️ resolveCompanyContact does an SMTP probe (port 25) — run this on the Hetzner worker, not Vercel.
import { fetchLeverPostings, getLeverSlugs, type LeverPosting } from './lever-ats';
import { resolveCompanyContact, type CompanyContact } from './company-contact';
import { getMaxJobAgeDate } from '@/lib/utils';
import { prisma } from '@/lib/db';

// STRICT role filter for ATS boards. The shared shouldImportByProfession is "default-allow", and
// even the broad isTargetProfession whitelist covers all 21 categories (incl. sales/ops/HR/finance)
// — too loose for a corporate Lever board (Phase 0 v1 saw 7001 "roles", v2 still leaked Account
// Executives, BDRs, Program Specialists). Our candidate pool is tech/data/design/product/content
// freelancers, so we use a NARROW positive whitelist of exactly those role families, an explicit
// EXCLUDE for the business-function tail that sneaks in (sales/account/recruiting/etc.), and drop
// on-site roles (remote pool). Title-only — fast, deterministic, no LLM.
const ATS_INCLUDE = /\b(software|backend|back-end|front-?end|full[\s-]?stack|web|mobile|ios|android|game|embedded|firmware|systems?|platform|cloud|infrastructure|network|devops|sre|site reliability|data|database|ml|machine learning|\bai\b|nlp|analytics|bi engineer|qa|quality assurance|sdet|automation (engineer|tester)|security|cyber|appsec|infosec|engineer|engineering|developer|programmer|architect|designer|\bux\b|\bui\b|product design|graphic|visual|motion|product manager|product owner|technical writer|content (writer|designer|strategist)|copywriter|translator|localization|localisation)\b/i;
const ATS_EXCLUDE = /\b(sales|account (executive|manager|director)|business development|pre-?sales|\bbdr\b|\bsdr\b|recruit(er|ing)|talent acquisition|customer success|program specialist|field cto|salesman|account based)\b/i;
const ONSITE = new Set(['on-site', 'onsite', 'in-office', 'in office']);
export function isTargetAtsRole(p: LeverPosting): boolean {
  const t = p.title || '';
  if (!ATS_INCLUDE.test(t) || ATS_EXCLUDE.test(t)) return false;
  if (p.workplaceType && ONSITE.has(p.workplaceType.toLowerCase())) return false;
  // Freshness: max 14 days (MAX_JOB_AGE_DAYS), same as the LinkedIn rule. Lever lists many stale /
  // evergreen reqs (medians run 1-5 months, tails to years) — we only pitch genuinely fresh openings.
  if (p.createdAt < getMaxJobAgeDate()) return false;
  return true;
}

export type LeverCompanyCard = {
  slug: string;
  name: string | null;
  contact: CompanyContact;
  roles: LeverPosting[];        // only target-profession roles
};

/** slug → company name (for domain resolution), read from the dormant DataSource table. */
export async function leverNameMap(slugs: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (!slugs.length) return map;
  try {
    const rows = await prisma.$queryRawUnsafe<{ companySlug: string; name: string | null }[]>(
      `SELECT "companySlug", name FROM "DataSource" WHERE "sourceType"='LEVER' AND "companySlug" = ANY($1)`, slugs);
    for (const r of rows) map.set((r.companySlug || '').toLowerCase().trim(), r.name);
  } catch { /* names are optional — domain resolution falls back to the slug */ }
  return map;
}

/**
 * Build company cards across (recently-active) Lever companies: fetch each board, keep only
 * target-profession roles, and resolve one contact per company that actually has such roles.
 * Sequential to respect Lever's ~2 req/s. Companies with no target role (or no usable contact when
 * `requireContact`) are dropped. Never throws on a single company.
 */
export async function buildLeverCompanyCards(opts: {
  limit?: number;
  requireContact?: boolean;
} = {}): Promise<LeverCompanyCard[]> {
  const slugs = await getLeverSlugs(opts.limit ?? 2060);
  const names = await leverNameMap(slugs);
  const cards: LeverCompanyCard[] = [];

  for (const slug of slugs) {
    try {
      const postings = await fetchLeverPostings(slug);
      const roles = postings.filter(isTargetAtsRole);
      if (!roles.length) continue;                              // no role we'd staff → don't bother

      const contact = await resolveCompanyContact({ slug, name: names.get(slug) ?? null });
      if (opts.requireContact && !contact.email) continue;       // skip companies we can't reach

      cards.push({ slug, name: names.get(slug) ?? null, contact, roles });
    } catch { /* skip a broken company, keep the run going */ }
    await new Promise(r => setTimeout(r, 600));                  // Lever rate limit
  }
  return cards;
}
