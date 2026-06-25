// Ingest ATS (Lever) postings INTO the Opportunity table, so they appear in the candidate discovery
// feed alongside LinkedIn opportunities. ATS roles are EXTERNAL-APPLY: applyUrl=public job page,
// applyEmail=NULL. That null is deliberate — the auto-apply send matcher requires applyEmail, so it
// never auto-sends to ATS roles; they surface in the feed via the cheap lexical fit-score only (no AI
// vetting cost). The candidate applies themselves on the company's ATS.
import { prisma } from '@/lib/db';
import { slugify } from '@/lib/utils';
import { classifyJobCategory } from '@/lib/ai';
import { assessContentQuality } from '@/lib/content-quality';
import { isTargetAtsRole, leverNameMap, type LeverCompanyCard } from './lever-pipeline';
import { getLeverSlugs, fetchLeverPostings, type LeverPosting } from './lever-ats';

const CATEGORY_NAMES: Record<string, string> = {
  engineering: 'Engineering', design: 'Design', data: 'Data', devops: 'DevOps', qa: 'QA',
  security: 'Security', product: 'Product', marketing: 'Marketing', sales: 'Sales', finance: 'Finance',
  hr: 'HR', operations: 'Operations', legal: 'Legal', 'project-management': 'Project Management',
  writing: 'Writing', translation: 'Translation', creative: 'Creative', support: 'Support',
  education: 'Education', research: 'Research', consulting: 'Consulting',
};

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 1; i <= 100; i++) {
    if (!(await prisma.opportunity.findUnique({ where: { slug }, select: { id: true } }))) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

async function resolveCategoryId(title: string): Promise<string> {
  const slug = await classifyJobCategory(title, []);
  const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { slug, name: CATEGORY_NAMES[slug] || slug } });
  return created.id;
}

function mapLocationType(workplaceType: string | null): 'REMOTE' | 'HYBRID' {
  return (workplaceType || '').toLowerCase() === 'hybrid' ? 'HYBRID' : 'REMOTE';
}

function mapSalaryPeriod(interval: string | null): 'HOUR' | 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' {
  const s = (interval || '').toLowerCase();
  if (s.includes('hour')) return 'HOUR';
  if (s.includes('day')) return 'DAY';
  if (s.includes('week')) return 'WEEK';
  if (s.includes('month')) return 'MONTH';
  return 'YEAR';
}

export type IngestOutcome = 'created' | 'duplicate' | 'skipped';

/** Map ONE Lever posting → Opportunity. companyName synthesizes the client identity. Never throws. */
export async function ingestLeverPosting(p: LeverPosting, companyName: string | null): Promise<IngestOutcome> {
  try {
    if (!isTargetAtsRole(p)) return 'skipped';                 // profession + ≤14d + non-onsite gate
    // Dedup by stable Lever UUID, then by public URL.
    const dup = await prisma.opportunity.findFirst({
      where: { OR: [{ sourceId: p.sourceId }, { sourceUrl: p.hostedUrl }] }, select: { id: true },
    });
    if (dup) return 'duplicate';

    const company = (companyName && companyName.trim()) || (p.companySlug.charAt(0).toUpperCase() + p.companySlug.slice(1));
    const description = [p.descriptionPlain, ...(p.requirements || [])].filter(Boolean).join('\n').trim();
    const categoryId = await resolveCategoryId(p.title);
    const baseSlug = slugify(`${p.title}-${p.companySlug}`);
    const slug = await uniqueSlug(baseSlug);

    const quality = assessContentQuality({
      description, salaryMin: p.salary?.min ?? null, skills: [],
      applyEmail: null, applyUrl: p.hostedUrl, isFreeEmail: false, isAnnouncement: false, apolloValidated: false,
    });

    const salary = p.salary && (p.salary.min || p.salary.max) ? {
      salaryMin: p.salary.min, salaryMax: p.salary.max,
      salaryCurrency: p.salary.currency || 'USD', salaryPeriod: mapSalaryPeriod(p.salary.interval),
      salaryIsEstimate: false,
    } : {};

    await prisma.opportunity.create({
      data: {
        slug,
        clientName: company,
        clientLinkedIn: p.hostedUrl,        // canonical public role URL (no poster identity on ATS)
        clientType: 'company',
        originalContent: description,
        title: p.title,
        description,
        categoryId,
        location: p.location,
        locationType: mapLocationType(p.workplaceType),
        country: p.country,
        level: 'MID',
        type: 'FREELANCE',
        skills: [],
        ...salary,
        applyEmail: null,                   // external-apply ⇒ invisible to auto-send matcher
        applyUrl: p.hostedUrl,
        sourceUrl: p.hostedUrl,
        sourceId: p.sourceId,
        source: 'ats_lever',
        contentQuality: quality.quality,
        qualityScore: quality.score,
        postedAt: p.createdAt,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });
    return 'created';
  } catch (e) {
    // P2002 (slug/sourceId race) ⇒ treat as duplicate; anything else logged, never throws.
    if ((e as { code?: string })?.code === 'P2002') return 'duplicate';
    console.error('[lever-ingest] failed:', p.companySlug, p.title, (e as Error)?.message);
    return 'skipped';
  }
}

/** Ingest all target roles for one company card. */
export async function ingestCompanyCard(card: LeverCompanyCard): Promise<Record<IngestOutcome, number>> {
  const tally: Record<IngestOutcome, number> = { created: 0, duplicate: 0, skipped: 0 };
  for (const role of card.roles) tally[await ingestLeverPosting(role, card.name)]++;
  return tally;
}

/**
 * Sweep Lever companies → ingest their fresh target roles as Opportunities. Sequential to respect
 * Lever's ~2 req/s. `limit` bounds the company count: keep it small on Vercel (300s cap); run the
 * full set on the Hetzner worker. Never throws on a single company.
 */
export async function ingestActiveLeverRoles(limit = 80): Promise<Record<IngestOutcome, number> & { companies: number }> {
  // Randomize so each slice covers different (mostly SMB) companies; dedup prevents re-ingest.
  const slugs = await getLeverSlugs(limit, { randomize: true });
  const names = await leverNameMap(slugs);
  const tally = { created: 0, duplicate: 0, skipped: 0, companies: 0 };
  for (const slug of slugs) {
    try {
      const postings = await fetchLeverPostings(slug);
      const fresh = postings.filter(isTargetAtsRole);
      if (fresh.length) tally.companies++;
      for (const role of fresh) tally[await ingestLeverPosting(role, names.get(slug) ?? null)]++;
    } catch { /* skip a broken company */ }
    await new Promise(r => setTimeout(r, 600));
  }
  return tally;
}
