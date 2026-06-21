import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { DiscoveryFeed } from '@/components/app/DiscoveryFeed';
import { buildFitContext, scoreFitLabeled, type FitLabel } from '@/lib/fit-score';
import './discovery-design.css';

export const metadata: Metadata = {
  title: 'Discovery — Freelanly',
};

// Per-user fit ranking — must never be cached across users.
export const dynamic = 'force-dynamic';

export default async function DiscoveryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const perPage = 50;

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

  type FeedItem = {
    id: string; type: 'opportunity' | 'job'; title: string; companyName: string; description: string;
    source: string; createdAt: string; skills: string[]; location: string | null; applyEmail: string | null;
    matchLabel: FitLabel; aiVerified: boolean; alreadyApplied: boolean; matchScore: number;
    matchedSkills: string[]; matchedTitleTokens: string[]; languageGap: string[]; missingCore: string[];
  };

  // ── Verified queue: the matches the auto-apply matcher ALREADY vetted as real (Strong/Good, not
  // rejected) and that are still live. Free + already computed → the honest core of the feed, shown
  // first regardless of lexical rank. A thin-but-true feed beats a thick-but-fake one (owner decision).
  const GOOD_STATUS = ['PENDING', 'REVIEW', 'SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER'];
  const SENT_STATUS = new Set(['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER']);
  // AutoApplication has no `opportunity` relation (only scalar opportunityId) — fetch verdicts, then
  // the live opportunities, and join in code.
  const queueApps = await prisma.autoApplication.findMany({
    where: {
      userId: session.user.id,
      matchLabel: { in: ['Strong', 'Good'] },
      status: { in: GOOD_STATUS as never },
      opportunityId: { not: null },
    },
    select: { opportunityId: true, matchLabel: true, status: true },
  });
  const qOppIds = [...new Set(queueApps.map(a => a.opportunityId!).filter(Boolean))];
  const qOpps = qOppIds.length ? await prisma.opportunity.findMany({
    where: { id: { in: qOppIds }, isActive: true, applyEmail: { not: null } },
    select: { id: true, title: true, clientName: true, posterCompany: true, description: true, createdAt: true, skills: true, location: true, applyEmail: true, company: { select: { name: true } } },
  }) : [];
  const qOppById = new Map(qOpps.map(o => [o.id, o]));
  const queueItemsRaw = queueApps.map((a): FeedItem | null => {
    const o = a.opportunityId ? qOppById.get(a.opportunityId) : null;
    if (!o) return null;
    const fit = scoreFitLabeled(fitCtx, { title: o.title, skills: o.skills });
    return {
      id: o.id, type: 'opportunity', title: o.title,
      companyName: o.company?.name || o.posterCompany || o.clientName || 'Unknown',
      description: o.description, source: 'linkedin', createdAt: o.createdAt.toISOString(),
      skills: o.skills, location: o.location, applyEmail: o.applyEmail,
      matchLabel: (a.matchLabel as FitLabel) || 'Good', aiVerified: true, alreadyApplied: SENT_STATUS.has(a.status),
      matchScore: 100, matchedSkills: fit.matchedSkills.slice(0, 4), matchedTitleTokens: fit.matchedTitleTokens,
      languageGap: [], missingCore: [],
    };
  });
  const queueItems: FeedItem[] = (queueItemsRaw.filter(Boolean) as FeedItem[])
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt)); // freshest first

  // ── Closest tail: the lexical-ranked pool (minus the queue), UNbadged — for browsing when the
  // verified queue is thin. No LLM at feed time; these never claim "Strong".
  const queueIds = new Set(queueItems.map(i => i.id));
  const closestRanked = ranked
    .filter(r => !queueIds.has(r.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()); // freshest first
  const closestSlice = closestRanked.slice(0, perPage);

  const oppIds = closestSlice.filter(r => r.type === 'opportunity').map(r => r.id);
  const jobIds = closestSlice.filter(r => r.type === 'job').map(r => r.id);
  const [opportunities, jobs] = await Promise.all([
    oppIds.length ? prisma.opportunity.findMany({
      where: { id: { in: oppIds } },
      select: { id: true, title: true, clientName: true, posterCompany: true, description: true, createdAt: true, skills: true, location: true, applyEmail: true, sourceUrl: true, company: { select: { name: true } } },
    }) : Promise.resolve([]),
    jobIds.length ? prisma.job.findMany({
      where: { id: { in: jobIds } },
      select: { id: true, title: true, description: true, createdAt: true, skills: true, country: true, applyEmail: true, sourceUrl: true, company: { select: { name: true } } },
    }) : Promise.resolve([]),
  ]);
  const oppById = new Map(opportunities.map(o => [o.id, o]));
  const jobById = new Map(jobs.map(j => [j.id, j]));

  const closestItems: FeedItem[] = closestSlice.map(r => {
    if (r.type === 'opportunity') {
      const o = oppById.get(r.id);
      if (!o) return null;
      return {
        id: o.id, type: 'opportunity' as const, title: o.title,
        companyName: o.company?.name || o.posterCompany || o.clientName || 'Unknown',
        description: o.description, source: 'linkedin', createdAt: o.createdAt.toISOString(),
        skills: o.skills, location: o.location, applyEmail: o.applyEmail,
        matchLabel: r.label, aiVerified: false, alreadyApplied: false,
        matchScore: r.score, matchedSkills: r.matchedSkills.slice(0, 4), matchedTitleTokens: r.matchedTitleTokens,
        languageGap: r.languageGap, missingCore: r.missingCore,
      };
    }
    const j = jobById.get(r.id);
    if (!j) return null;
    return {
      id: j.id, type: 'job' as const, title: j.title, companyName: j.company.name,
      description: j.description, source: j.sourceUrl?.includes('lever') ? 'Lever' : j.sourceUrl?.includes('linkedin') ? 'linkedin' : 'careers page',
      createdAt: j.createdAt.toISOString(), skills: j.skills, location: j.country, applyEmail: j.applyEmail,
      matchLabel: r.label, aiVerified: false, alreadyApplied: false,
      matchScore: r.score, matchedSkills: r.matchedSkills.slice(0, 4), matchedTitleTokens: r.matchedTitleTokens,
      languageGap: r.languageGap, missingCore: r.missingCore,
    };
  }).filter(Boolean) as FeedItem[];

  // Verified queue first, then the closest tail (top N, no pagination — the feed is the few real
  // matches; "similar" is opt-in via a button in the client).
  const items: FeedItem[] = [...queueItems, ...closestItems];

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
          topSkills={topSkills}
          sourceCounts={Object.entries(sourceCounts)}
        />
      </div>

    </div>
  );
}
