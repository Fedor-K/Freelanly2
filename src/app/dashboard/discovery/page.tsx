import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { DiscoveryFeed } from '@/components/app/DiscoveryFeed';
import { buildFitContext, scoreFitLabeled, type FitLabel } from '@/lib/fit-score';
import { getVerdicts } from '@/lib/match-verdict';
import './discovery-design.css';

export const metadata: Metadata = {
  title: 'Discovery — Freelanly',
};

// Per-user fit ranking — must never be cached across users.
export const dynamic = 'force-dynamic';

export default async function DiscoveryPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const params = await searchParams;
  const page = parseInt(params.page || '1') || 1;
  const perPage = 50;
  const skip = (page - 1) * perPage;

  const dayAgo = new Date(Date.now() - 24 * 3600000);
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  // Profile-aware feed: rank the WHOLE week's base by lexical fit to this user (no LLM, runs in code),
  // so everyone opens Discovery and sees roles that match their background first — not just newest.
  // Pass 1 pulls light rows (id/title/skills/createdAt) for the full base, scores + sorts + paginates
  // in code; pass 2 fetches display fields only for the page's 50. Score 0 (no profile, or no overlap)
  // falls back to recency — nothing is hidden, only re-ranked.
  // No résumé yet → send to in-app résumé onboarding, NOT an empty feed. Discovery is the post-login
  // landing now, so this guard (mirrors src/app/dashboard/page.tsx) must live here too — without a
  // parsedProfile there's nothing to match against. Also prevents the old login-loop.
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { parsedProfile: true, resumeUrl: true, resumeText: true } });
  if (!me?.resumeUrl) redirect('/dashboard/settings#profile');
  const fitCtx = buildFitContext(me?.parsedProfile as Record<string, unknown> | null);

  const [poolOpps, poolJobs, totalToday] = await Promise.all([
    prisma.opportunity.findMany({
      where: { isActive: true, createdAt: { gte: weekAgo }, applyEmail: { not: null } },
      select: { id: true, title: true, skills: true, createdAt: true },
    }),
    prisma.job.findMany({
      where: { isActive: true, createdAt: { gte: weekAgo }, applyEmail: { not: null } },
      select: { id: true, title: true, skills: true, createdAt: true },
    }),
    prisma.opportunity.count({ where: { isActive: true, createdAt: { gte: dayAgo } } }),
  ]);

  // Score every row, then order Strong → Good → (recency for the rest). Self-appliable only
  // (applyEmail filter above) — "could self-apply" is the whole point.
  const RANK: Record<FitLabel, number> = { Strong: 0, Good: 1, Weak: 2 };
  const ranked = [
    ...poolOpps.map(o => ({ id: o.id, type: 'opportunity' as const, createdAt: o.createdAt, ...scoreFitLabeled(fitCtx, o) })),
    ...poolJobs.map(j => ({ id: j.id, type: 'job' as const, createdAt: j.createdAt, ...scoreFitLabeled(fitCtx, j) })),
  ].sort((a, b) =>
    (RANK[a.label] - RANK[b.label]) || (b.score - a.score) || (b.createdAt.getTime() - a.createdAt.getTime()),
  );

  // The feed IS the strong matches — don't pad. Only when a niche profile has too few strong do we top
  // up (with the best non-strong) to a floor, so the landing is never near-empty. A profile with 39
  // strong sees 39, not 50.
  const STRONG_FLOOR = 12;
  const strongRows = ranked.filter(r => r.label === 'Strong');
  const feed = strongRows.length >= STRONG_FLOOR ? strongRows : ranked.slice(0, STRONG_FLOOR);

  const total = feed.length;
  const pageSlice = feed.slice(skip, skip + perPage);
  const hasMore = skip + perPage < total;

  // Pass 2 — fetch display fields only for the IDs on this page, then restore the ranked order.
  const oppIds = pageSlice.filter(r => r.type === 'opportunity').map(r => r.id);
  const jobIds = pageSlice.filter(r => r.type === 'job').map(r => r.id);
  const [opportunities, jobs] = await Promise.all([
    oppIds.length ? prisma.opportunity.findMany({
      where: { id: { in: oppIds } },
      select: {
        id: true, title: true, clientName: true, posterCompany: true,
        description: true, createdAt: true, skills: true, location: true,
        applyEmail: true, sourceUrl: true,
        company: { select: { name: true } },
      },
    }) : Promise.resolve([]),
    jobIds.length ? prisma.job.findMany({
      where: { id: { in: jobIds } },
      select: {
        id: true, title: true, description: true, createdAt: true,
        skills: true, country: true, applyEmail: true, sourceUrl: true,
        company: { select: { name: true } },
      },
    }) : Promise.resolve([]),
  ]);

  const oppById = new Map(opportunities.map(o => [o.id, o]));
  const jobById = new Map(jobs.map(j => [j.id, j]));

  // LLM-verify the top-K strong-lexical opportunities on this page — the real assessPairing verdict
  // overrides the cheap lexical label (false "Strong" demoted, hard rejects dropped). Synchronous
  // (~1.5s on first view of a new set), cached forever in MatchVerdict so later loads are instant
  // (Option A). Fail-open: a vetting error falls back to the lexical labels.
  const TOP_K = 8;
  const toVet = pageSlice
    .filter(r => r.type === 'opportunity' && r.label === 'Strong')
    .slice(0, TOP_K)
    .map(r => oppById.get(r.id))
    .filter((o): o is NonNullable<typeof o> => !!o)
    .map(o => ({ id: o.id, title: o.title, description: o.description }));
  let verdicts = new Map<string, { label: FitLabel; decision: 'NO' | 'SEND' }>();
  try {
    verdicts = await getVerdicts(
      { id: session.user.id, parsedProfile: me.parsedProfile as Record<string, unknown> | null, resumeText: me.resumeText, resumeUrl: me.resumeUrl },
      toVet,
    );
  } catch (e) {
    console.error('[discovery] vet failed, falling back to lexical:', e);
  }

  let items = pageSlice.map(r => {
    if (r.type === 'opportunity') {
      const o = oppById.get(r.id);
      if (!o) return null;
      const v = verdicts.get(o.id);
      return {
        id: o.id,
        type: 'opportunity' as const,
        title: o.title,
        companyName: o.company?.name || o.posterCompany || o.clientName || 'Unknown',
        description: o.description,
        source: 'linkedin',
        createdAt: o.createdAt.toISOString(),
        skills: o.skills,
        location: o.location,
        applyEmail: o.applyEmail,
        matchLabel: v ? v.label : r.label,  // real LLM verdict overrides lexical when present
        aiVerified: !!v,
        matchScore: r.score,
        matchedSkills: r.matchedSkills.slice(0, 4),
        matchedTitleTokens: r.matchedTitleTokens,
        languageGap: r.languageGap,
        missingCore: r.missingCore,
      };
    }
    const j = jobById.get(r.id);
    if (!j) return null;
    return {
      id: j.id,
      type: 'job' as const,
      title: j.title,
      companyName: j.company.name,
      description: j.description,
      source: j.sourceUrl?.includes('lever') ? 'Lever' : j.sourceUrl?.includes('linkedin') ? 'linkedin' : 'careers page',
      createdAt: j.createdAt.toISOString(),
      skills: j.skills,
      location: j.country,
      applyEmail: j.applyEmail,
      matchLabel: r.label,
      aiVerified: false,
      matchScore: r.score,
      matchedSkills: r.matchedSkills.slice(0, 4),
      matchedTitleTokens: r.matchedTitleTokens,
      languageGap: r.languageGap,
      missingCore: r.missingCore,
    };
  }).filter(Boolean) as Array<{
    id: string; type: 'opportunity' | 'job'; title: string; companyName: string;
    description: string; source: string; createdAt: string; skills: string[];
    location: string | null; applyEmail: string | null;
    matchLabel: FitLabel; aiVerified: boolean; matchScore: number; matchedSkills: string[]; matchedTitleTokens: string[];
    languageGap: string[]; missingCore: string[];
  }>;

  // Apply the LLM verdicts: drop hard rejects (the matcher said NO / Weak), then re-sort so any
  // demoted-to-Good items sink below the confirmed Strong ones. Stable sort preserves lexical order
  // within a label.
  items = items
    .filter(it => { const v = verdicts.get(it.id); return !(v && (v.decision === 'NO' || v.label === 'Weak')); })
    .sort((a, b) => RANK[a.matchLabel] - RANK[b.matchLabel]);

  // Compute top skills with counts
  const skillCounts: Record<string, number> = {};
  for (const item of items) {
    for (const s of item.skills) {
      skillCounts[s] = (skillCounts[s] || 0) + 1;
    }
  }
  const topSkills = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);

  // Compute sources
  const sourceCounts: Record<string, number> = {};
  for (const item of items) {
    const src = item.source.includes('linkedin') ? 'LinkedIn posts' : item.source.includes('Lever') ? 'Career pages' : 'Career pages';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }

  return (
    <div className="page">

      <div className="page-header">
        <div className="page-title">
          <h1>Discovery <span style={{fontSize: '16px', color: 'var(--ink-4)', fontWeight: 400, fontFamily: "'Geist Mono', monospace"}}>· {totalToday} new today</span></h1>
          <p>Live feed across LinkedIn posts, career pages, and freelance boards. Updated every 3 hours.</p>
        </div>
      </div>

      <div className="disco-grid">
        <DiscoveryFeed
          items={items}
          total={total}
          topSkills={topSkills}
          sourceCounts={Object.entries(sourceCounts)}
        />
      </div>

      {/* Pagination */}
      <div style={{display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px'}}>
        {page > 1 && (
          <a href={`/dashboard/discovery?page=${page - 1}`} className="btn btn-ghost btn-sm">← Previous</a>
        )}
        <span style={{fontSize: '13px', color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace", alignSelf: 'center'}}>Page {page}</span>
        {hasMore && (
          <a href={`/dashboard/discovery?page=${page + 1}`} className="btn btn-ghost btn-sm">Next →</a>
        )}
      </div>

    </div>
  );
}
