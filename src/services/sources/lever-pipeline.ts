// Lever pipeline glue — ties the demand-side blocks together:
//   getLeverSlugs (DataSource)  →  fetchLeverPostings  →  keep target professions (shouldSkipJob)
//   →  resolveCompanyContact (real domain + verified alias, cached, FREE)  →  one card per company.
// The output (company + its open target roles + a contact email) is what block 4 sends, and what
// buildShortlistForRole consumes to attach 3 vetted candidates per role.
//
// ⚠️ resolveCompanyContact does an SMTP probe (port 25) — run this on the Hetzner worker, not Vercel.
import { fetchLeverPostings, getLeverSlugs, type LeverPosting } from './lever-ats';
import { resolveCompanyContact, type CompanyContact } from './company-contact';
import { shouldSkipJob } from '@/lib/job-filter';
import { prisma } from '@/lib/db';

export type LeverCompanyCard = {
  slug: string;
  name: string | null;
  contact: CompanyContact;
  roles: LeverPosting[];        // only target-profession roles
};

/** slug → company name (for domain resolution), read from the dormant DataSource table. */
async function leverNameMap(slugs: string[]): Promise<Map<string, string | null>> {
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
      const roles = postings.filter(p => !shouldSkipJob({ title: p.title, location: p.location, locationType: p.workplaceType }).skip);
      if (!roles.length) continue;                              // no role we'd staff → don't bother

      const contact = await resolveCompanyContact({ slug, name: names.get(slug) ?? null });
      if (opts.requireContact && !contact.email) continue;       // skip companies we can't reach

      cards.push({ slug, name: names.get(slug) ?? null, contact, roles });
    } catch { /* skip a broken company, keep the run going */ }
    await new Promise(r => setTimeout(r, 600));                  // Lever rate limit
  }
  return cards;
}
