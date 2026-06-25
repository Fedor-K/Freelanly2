// Lever ATS source — pulls REAL open roles from companies' public Lever boards.
//
// This is the demand-side source for the recruiter-shortlist product (NOT the old candidate
// auto-apply): ATS roles come from direct hirers with real (employer-stated) salary, unlike the
// LinkedIn-post applyEmails which are mostly staffing bodyshops. Per role we later match 3 vetted
// candidates and push a shortlist to the hiring decision-maker (contact resolved for free by
// company-contact.ts — real domain + verified role-alias, no paid enrichment).
//
// API: GET https://api.lever.co/v0/postings/{site}?mode=json — PUBLIC, no auth, ~2 req/s.
// Returns [] for a valid site with no open roles; {"ok":false,"error":"Document not found"} for a
// non-Lever slug. Site slug = the path in jobs.lever.co/{slug}. Discovering slugs (which companies
// are on Lever) is a SEPARATE feeder (Apify lever scraper / TheirStack list) — this module just
// fetches + normalizes once we have a slug.

export type LeverPosting = {
  sourceId: string;          // Lever posting UUID (stable dedupe key)
  source: 'lever';
  companySlug: string;       // the Lever site slug (e.g. "palantir")
  title: string;
  location: string | null;   // categories.location
  country: string | null;    // ISO2
  workplaceType: string | null; // remote | on-site | hybrid | unspecified
  commitment: string | null; // Full-time | Contract | ...
  team: string | null;
  // Real employer-stated salary when present (Lever only fills it where the employer added it).
  salary: { currency: string; interval: string; min: number | null; max: number | null } | null;
  descriptionPlain: string;  // full JD text (intro + body), for the matcher
  requirements: string[];    // flattened bullet points from `lists`
  applyUrl: string;          // hosted Lever apply form (fallback only — our model bypasses it)
  hostedUrl: string;         // public job page (used for Apollo company-domain lookup)
  createdAt: Date;
};

const stripHtml = (html: string): string =>
  (html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

/** Fetch + normalize one company's open Lever postings. Returns [] for empty/non-Lever/errors. */
export async function fetchLeverPostings(slug: string): Promise<LeverPosting[]> {
  let data: unknown;
  try {
    const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`, {
      headers: { 'User-Agent': 'Freelanly/1.0' },
    });
    if (!res.ok) return [];
    data = await res.json();
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return []; // {"ok":false,...} = not a Lever site
  const out: LeverPosting[] = [];
  for (const r of data as Record<string, unknown>[]) {
    const cats = (r.categories || {}) as Record<string, unknown>;
    const sr = r.salaryRange as Record<string, unknown> | null;
    const lists = Array.isArray(r.lists) ? (r.lists as Record<string, unknown>[]) : [];
    const requirements = lists
      .flatMap(l => stripHtml(String(l.content || '')).split(/(?<=\.)\s+|\s*•\s*|\s{2,}/))
      .map(s => s.trim()).filter(s => s.length > 8).slice(0, 25);
    out.push({
      sourceId: String(r.id || ''),
      source: 'lever',
      companySlug: slug,
      title: String(r.text || '').trim(),
      location: (cats.location as string) || null,
      country: (r.country as string) || null,
      workplaceType: (r.workplaceType as string) || null,
      commitment: (cats.commitment as string) || null,
      team: (cats.team as string) || null,
      salary: sr ? {
        currency: String(sr.currency || ''),
        interval: String(sr.interval || ''),
        min: typeof sr.min === 'number' ? sr.min : null,
        max: typeof sr.max === 'number' ? sr.max : null,
      } : null,
      descriptionPlain: String(r.descriptionPlain || r.openingPlain || stripHtml(String(r.description || ''))).trim(),
      requirements,
      applyUrl: String(r.applyUrl || ''),
      hostedUrl: String(r.hostedUrl || ''),
      createdAt: new Date(typeof r.createdAt === 'number' ? r.createdAt : Date.now()),
    });
  }
  return out;
}

/** Pull many companies sequentially (respects Lever's ~2 req/s). De-dupes by sourceId. */
export async function fetchAllLeverPostings(slugs: string[]): Promise<LeverPosting[]> {
  const seen = new Set<string>();
  const all: LeverPosting[] = [];
  for (const slug of slugs) {
    const rows = await fetchLeverPostings(slug);
    for (const p of rows) {
      if (!p.sourceId || seen.has(p.sourceId)) continue;
      seen.add(p.sourceId);
      all.push(p);
    }
    await new Promise(r => setTimeout(r, 600)); // stay under the rate limit
  }
  return all;
}

// Slug feeder: the old ATS discovery already accumulated ~2,060 Lever companies in the (dormant)
// DataSource table — 1,938 with a successful run in the last 120 days. We read slugs from there
// (raw SQL — DataSource is a dormant table we don't model in the client), highest-import first, so
// the most productive boards come first. No Apify / no guessing needed.
import { prisma } from '@/lib/db';

export async function getLeverSlugs(limit = 2060, opts: { randomize?: boolean } = {}): Promise<string[]> {
  // randomize=true: a small slice (e.g. the Vercel ingest cron's limit=80) rotates across the whole
  // ~2000-company population over repeated runs instead of always hitting the top importers — and
  // since 97% of the list is small companies, a random draw naturally favors SMBs over the few giants.
  const orderBy = opts.randomize ? 'random()' : '"totalImported" DESC NULLS LAST';
  const rows = await prisma.$queryRawUnsafe<{ companySlug: string }[]>(
    `SELECT "companySlug" FROM "DataSource"
     WHERE "sourceType"='LEVER' AND "isActive"=true AND "companySlug" IS NOT NULL
       AND "lastSuccessAt" > now() - interval '120 days'
     ORDER BY ${orderBy}
     LIMIT $1`, limit);
  return [...new Set(rows.map(r => (r.companySlug || '').toLowerCase().trim()).filter(Boolean))];
}

/** Pull live postings across all (recently-active) Lever companies from DataSource. */
export async function fetchActiveLeverPostings(limit = 2060): Promise<LeverPosting[]> {
  const slugs = await getLeverSlugs(limit);
  return fetchAllLeverPostings(slugs);
}
