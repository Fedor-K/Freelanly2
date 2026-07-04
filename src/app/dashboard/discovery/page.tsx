import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { DiscoveryFeed } from '@/components/app/DiscoveryFeed';
import { buildFitContext, scoreFitLabeled, type FitLabel, type FitResult } from '@/lib/fit-score';
import { verifiedSkillsFor, type ReviewRow } from '@/lib/github-review/evidence';
import { readVettedFeed } from '@/services/feed-vet';
import { profileStamp } from '@/services/matching/assess-pairing-cached';
import { getVerdicts, type Verdict } from '@/lib/match-verdict';
import { getUserEmbedding, semanticPool, unembeddedRecentOpps } from '@/services/embeddings/semantic-rank';
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

  // Vetted-only feed (two-stage gate): render ONLY gate-approved cards for flagged users.
  // VETTED_FEED = 'all' | comma-separated user ids | unset (off).
  const VETTED_ENV = process.env.VETTED_FEED || '';
  const vettedFeedOn = VETTED_ENV === 'all' || VETTED_ENV.split(',').map(x => x.trim()).filter(Boolean).includes(session.user.id);

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
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { parsedProfile: true, resumeUrl: true, resumeText: true, githubUrl: true, githubReview: { select: { verdict: true, report: true, profileStamp: true, reviewedAt: true } } } });
  if (!me?.resumeUrl) redirect('/dashboard/settings#profile');
  // Repo-verified skills (fresh, positive GitHub review) weigh extra in ranking + light the card badge.
  const ghVerifiedSkills = verifiedSkillsFor({ githubUrl: me.githubUrl, parsedProfile: me.parsedProfile }, (me.githubReview as ReviewRow | null) ?? null);
  const ghVerifiedSet = new Set(ghVerifiedSkills.map(v => v.toLowerCase().trim()));
  const ghOverlap = (matched: string[]) => matched.some(m => ghVerifiedSet.has(String(m).toLowerCase().trim()));
  const fitCtx = buildFitContext(me?.parsedProfile as Record<string, unknown> | null, ghVerifiedSkills);

  // Has this user ever applied? Drives the first-apply hero + nudge for fresh (profile-only) signups.
  const priorApplies = await prisma.autoApplication.count({ where: { userId: session.user.id, origin: 'SELF', sentAt: { not: null } } });
  const hasApplied = priorApplies > 0;

  // Auto-apply state: signups create a loop in MANUAL (self-apply default). Surface a one-click
  // opt-in in onboarding, since most users register expecting auto-apply and don't know it's optional.
  const myLoops = await prisma.autoApplyLoop.findMany({ where: { userId: session.user.id }, select: { id: true, mode: true } });
  const loopIds = myLoops.map((l) => l.id);
  const autoApplyOn = myLoops.some((l) => l.mode === 'AUTO');

  const totalToday = await prisma.opportunity.count({ where: { isActive: true, createdAt: { gte: dayAgo } } });

  // SEMANTIC ranking (behind FEED_SEMANTIC_RANK): rank by meaning (precomputed embeddings, pgvector
  // SQL — no model call here) instead of lexical token overlap, with the semantic floor in
  // scoreFitLabeled demoting the bucket-B over-promises. Falls back to the original lexical pool
  // whenever the flag is off OR this user isn't embedded yet (cold start). Both produce the same row
  // shape and the same Strong → Good → recency order.
  const SEMANTIC = process.env.FEED_SEMANTIC_RANK === '1' || process.env.FEED_SEMANTIC_RANK === 'on';
  const userVec = SEMANTIC ? await getUserEmbedding(session.user.id) : null;

  const RANK: Record<FitLabel, number> = { Strong: 0, Good: 1, Weak: 2 };
  type RankedRow = { id: string; type: 'opportunity' | 'job'; createdAt: Date } & FitResult;
  const byFit = (a: RankedRow, b: RankedRow) =>
    (RANK[a.label] - RANK[b.label]) || (b.score - a.score) || (b.createdAt.getTime() - a.createdAt.getTime());

  let ranked: RankedRow[];
  if (userVec) {
    // pgvector top-N by cosine, scored through the hybrid (sim passed in), plus recent not-yet-embedded
    // opps scored lexically so a just-ingested role isn't invisible while the embed cron catches up.
    const [{ opps, jobs }, unembedded] = await Promise.all([
      semanticPool(userVec, { weekAgo, limit: 400 }),
      unembeddedRecentOpps(weekAgo, 100),
    ]);
    ranked = [
      ...opps.map(o => ({ id: o.id, type: 'opportunity' as const, createdAt: o.createdAt, ...scoreFitLabeled(fitCtx, { title: o.title, skills: o.skills }, o.sim) })),
      ...jobs.map(j => ({ id: j.id, type: 'job' as const, createdAt: j.createdAt, ...scoreFitLabeled(fitCtx, { title: j.title, skills: j.skills }, j.sim) })),
      ...unembedded.map(o => ({ id: o.id, type: 'opportunity' as const, createdAt: o.createdAt, ...scoreFitLabeled(fitCtx, { title: o.title, skills: o.skills }) })),
    ].sort(byFit);
  } else {
    // Original lexical pool: pull light rows for the 7-day base, score + sort in code (no LLM).
    const [poolOpps, poolJobs] = await Promise.all([
      prisma.opportunity.findMany({
        // self-appliable (applyEmail) OR external-apply ATS roles (applyUrl) — both belong in the feed
        where: { isActive: true, createdAt: { gte: weekAgo }, OR: [{ applyEmail: { not: null } }, { applyUrl: { not: null } }] },
        select: { id: true, title: true, skills: true, createdAt: true },
      }),
      prisma.job.findMany({
        where: { isActive: true, createdAt: { gte: weekAgo }, applyEmail: { not: null } },
        select: { id: true, title: true, skills: true, createdAt: true },
      }),
    ]);
    ranked = [
      ...poolOpps.map(o => ({ id: o.id, type: 'opportunity' as const, createdAt: o.createdAt, ...scoreFitLabeled(fitCtx, o) })),
      ...poolJobs.map(j => ({ id: j.id, type: 'job' as const, createdAt: j.createdAt, ...scoreFitLabeled(fitCtx, j) })),
    ].sort(byFit);
  }

  type FeedItem = {
    id: string; type: 'opportunity' | 'job'; title: string; companyName: string; description: string;
    source: string; createdAt: string; skills: string[]; location: string | null; applyEmail: string | null;
    applyUrl: string | null;
    matchLabel: FitLabel; aiVerified: boolean; alreadyApplied: boolean; matchScore: number;
    matchedSkills: string[]; matchedTitleTokens: string[]; languageGap: string[]; missingCore: string[];
    githubVerified: boolean;
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
    where: { id: { in: qOppIds }, isActive: true, OR: [{ applyEmail: { not: null } }, { applyUrl: { not: null } }] },
    select: { id: true, title: true, clientName: true, posterCompany: true, description: true, createdAt: true, skills: true, location: true, applyEmail: true, applyUrl: true, source: true, company: { select: { name: true } } },
  }) : [];
  const qOppById = new Map(qOpps.map(o => [o.id, o]));
  const queueItemsRaw = queueApps.map((a): FeedItem | null => {
    const o = a.opportunityId ? qOppById.get(a.opportunityId) : null;
    if (!o) return null;
    const fit = scoreFitLabeled(fitCtx, { title: o.title, skills: o.skills });
    return {
      id: o.id, type: 'opportunity', title: o.title,
      companyName: o.company?.name || o.posterCompany || o.clientName || 'Unknown',
      description: o.description, source: o.source === 'ats_lever' ? 'Lever' : 'linkedin', createdAt: o.createdAt.toISOString(),
      skills: o.skills, location: o.location, applyEmail: o.applyEmail, applyUrl: o.applyUrl,
      matchLabel: (a.matchLabel as FitLabel) || 'Good', aiVerified: true, alreadyApplied: SENT_STATUS.has(a.status),
      githubVerified: ghOverlap(fit.matchedSkills),
      matchScore: 100, matchedSkills: fit.matchedSkills.slice(0, 4), matchedTitleTokens: fit.matchedTitleTokens,
      languageGap: [], missingCore: [],
    };
  });
  const queueItems: FeedItem[] = (queueItemsRaw.filter(Boolean) as FeedItem[])
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt)); // freshest first

  // ── Closest tail: the lexical fit-ranked pool (minus the queue), UNbadged — for browsing when the
  // verified queue is thin. No LLM at feed time; these never claim "Strong".
  // KEEP the fit order from `ranked` (RANK[label] → score → recency) — do NOT re-sort by date. The tail
  // is the bulk of what users browse, so it must be best-fit-first, not newest-first-for-everyone (that
  // was showing a bank clerk "Data Scientist" just because it was fresh). Also drop zero-overlap roles
  // (score 0) so off-profile users see a thin honest feed, not irrelevant gigs. "Newest" is still
  // available via the client sort toggle for users who want to browse chronologically.
  // AI-verdict cache: hide pairs the apply-gate (assessPairing) has already rejected for THIS user, so
  // the feed stops showing what apply would refuse (the lexical Good+ over-promised vs the strict AI).
  // Only honour a NO that's still fresh — same profileStamp (profile unchanged since) AND within the
  // 14d TTL — otherwise a stale NO would hide a role forever (it can't be re-judged while hidden).
  const meStamp = profileStamp({
    resumeUrl: me.resumeUrl,
    skills: (me.parsedProfile as Record<string, unknown> | null)?.skills as string[] | undefined,
    title: (me.parsedProfile as Record<string, unknown> | null)?.current_title as string | undefined,
  });
  const VERDICT_TTL_MS = 14 * 864e5;
  const noVerdictOpps = new Set(
    (await prisma.pairingVerdict.findMany({ where: { userId: session.user.id, decision: 'NO' }, select: { opportunityId: true, profileStamp: true, createdAt: true } }))
      .filter(v => v.profileStamp === meStamp && Date.now() - v.createdAt.getTime() < VERDICT_TTL_MS)
      .map(v => v.opportunityId),
  );

  // The verified queue only badges the user's Strong/Good+sent applications, but the apply-gate
  // (quick-apply) blocks on ANY AutoApplication for the opp/job — so a lexical-tail card the user
  // already applied to (self-apply, or an app outside the queueable window) showed a live "Apply"
  // button that the server then refused with already_applied. Mirror the server's check here so those
  // cards render "✓ Applied" instead.
  const appliedApps = await prisma.autoApplication.findMany({
    // Only LIVE applications paint the "Applied" chip — dead queue debris (expired/matcher-declined)
    // was marking cards as applied that the user never actually reached a recruiter through.
    where: { userId: session.user.id, status: { notIn: ['FAILED', 'MATCH_REJECTED', 'SKIPPED'] } },
    select: { opportunityId: true, jobId: true },
  });
  const appliedOppIds = new Set(appliedApps.map(a => a.opportunityId).filter(Boolean));
  const appliedJobIds = new Set(appliedApps.map(a => a.jobId).filter(Boolean));

  // Show only Good+ matches (label !== 'Weak') across BOTH sources: the role's profession must overlap
  // the candidate's, OR there's strong skill overlap. A single incidental shared skill (Weak, e.g. a
  // designer matching a dev role on "JavaScript") isn't enough — for LinkedIn or ATS. Off-profile users
  // get a thin honest feed instead of noise; "Newest" stays on the client sort toggle.
  const queueIds = new Set(queueItems.map(i => i.id));
  const closestRanked = ranked.filter(r => !queueIds.has(r.id) && r.label !== 'Weak' && !noVerdictOpps.has(r.id));
  const closestSlice = closestRanked.slice(0, perPage);

  const oppIds = closestSlice.filter(r => r.type === 'opportunity').map(r => r.id);
  const jobIds = closestSlice.filter(r => r.type === 'job').map(r => r.id);
  const [opportunities, jobs] = await Promise.all([
    oppIds.length ? prisma.opportunity.findMany({
      where: { id: { in: oppIds } },
      select: { id: true, title: true, clientName: true, posterCompany: true, description: true, createdAt: true, skills: true, location: true, applyEmail: true, applyUrl: true, source: true, sourceUrl: true, company: { select: { name: true } } },
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
        description: o.description, source: o.source === 'ats_lever' ? 'Lever' : 'linkedin', createdAt: o.createdAt.toISOString(),
        skills: o.skills, location: o.location, applyEmail: o.applyEmail, applyUrl: o.applyUrl,
        matchLabel: r.label, aiVerified: false, alreadyApplied: appliedOppIds.has(o.id),
        githubVerified: ghOverlap(r.matchedSkills),
        matchScore: r.score, matchedSkills: r.matchedSkills.slice(0, 4), matchedTitleTokens: r.matchedTitleTokens,
        languageGap: r.languageGap, missingCore: r.missingCore,
      };
    }
    const j = jobById.get(r.id);
    if (!j) return null;
    return {
      id: j.id, type: 'job' as const, title: j.title, companyName: j.company.name,
      description: j.description, source: j.sourceUrl?.includes('lever') ? 'Lever' : j.sourceUrl?.includes('linkedin') ? 'linkedin' : 'careers page',
      createdAt: j.createdAt.toISOString(), skills: j.skills, location: j.country, applyEmail: j.applyEmail, applyUrl: null,
      matchLabel: r.label, aiVerified: false, alreadyApplied: appliedJobIds.has(j.id),
      githubVerified: ghOverlap(r.matchedSkills),
      matchScore: r.score, matchedSkills: r.matchedSkills.slice(0, 4), matchedTitleTokens: r.matchedTitleTokens,
      languageGap: r.languageGap, missingCore: r.missingCore,
    };
  }).filter(Boolean) as FeedItem[];

  // ── Reconcile the lexical tail with the REAL apply-gate, CACHE-ONLY (no render latency, no LLM):
  // reuse the verdicts the auto-apply matcher already computed for THIS user (MatchVerdict cache +
  // the matcher's own MATCH_REJECTED rows). Drop opportunities the gate would refuse so the feed stops
  // showing cards that apply then rejects with poor_match (the feed↔gate divergence — ~40% of feed
  // draft failures), and upgrade matcher-confirmed pairs to an honest AI-verified badge. Novel pairs
  // (no cached verdict) stay lexical and are caught by the first-click PairingVerdict cache above.
  const vettable = closestItems
    .filter(i => i.type === 'opportunity')
    .map(i => ({ id: i.id, title: i.title, description: i.description }));
  let tailVerdicts = new Map<string, Verdict>();
  if (vettable.length) {
    try {
      tailVerdicts = await getVerdicts(
        { id: session.user.id, parsedProfile: me.parsedProfile as Record<string, unknown> | null, resumeText: me.resumeText, resumeUrl: me.resumeUrl },
        vettable,
        { cacheOnly: true },
      );
    } catch { /* fail-open: keep the lexical tail unchanged */ }
  }
  const vettedClosest = closestItems.flatMap(i => {
    const v = tailVerdicts.get(i.id);
    if (v?.decision === 'NO') return [];                                              // matcher already rejected → don't over-promise
    if (v?.decision === 'SEND') return [{ ...i, aiVerified: true, matchLabel: v.label }]; // confirmed fit → honest badge
    return [i];                                                                       // no cached verdict → lexical fallback
  });

  // Verified queue first, then the (gate-reconciled) closest tail (top N, no pagination — the feed is
  // the few real matches; "similar" is opt-in via a button in the client).
  let items: FeedItem[] = [...queueItems, ...vettedClosest];

  // ── ATS autofill-beta test boost (temporary, remove with the /autofill fake door): guarantee real
  // Lever roles are visible in the shortlist while we measure demand for 1-click autofill. ATS cards
  // rank low organically (their skills field is thinner than AI-extracted LinkedIn posts), so if the
  // list has fewer than ATS_SLOTS of them, pull the user's best-fitting extra ATS roles (any skill
  // overlap, not applied, not gate-rejected) and interleave them below the verified queue.
  const ATS_SLOTS = 8;
  const atsInList = items.filter(i => i.applyUrl && !i.applyEmail).length;
  if (atsInList < ATS_SLOTS) {
    const shownIds = new Set(items.map(i => i.id));
    const atsPool = await prisma.opportunity.findMany({
      where: { isActive: true, createdAt: { gte: weekAgo }, applyUrl: { not: null }, applyEmail: null },
      select: { id: true, title: true, clientName: true, posterCompany: true, description: true, createdAt: true, skills: true, location: true, applyEmail: true, applyUrl: true, source: true, company: { select: { name: true } } },
    });
    const extraAts: FeedItem[] = atsPool
      .filter(o => !shownIds.has(o.id) && !appliedOppIds.has(o.id) && !noVerdictOpps.has(o.id))
      .map(o => ({ o, fit: scoreFitLabeled(fitCtx, { title: o.title, skills: o.skills }) }))
      .filter(x => x.fit.score > 0)
      .sort((a, b) => (RANK[a.fit.label] - RANK[b.fit.label]) || (b.fit.score - a.fit.score) || (b.o.createdAt.getTime() - a.o.createdAt.getTime()))
      .slice(0, ATS_SLOTS - atsInList)
      .map(({ o, fit }) => ({
        id: o.id, type: 'opportunity' as const, title: o.title,
        companyName: o.company?.name || o.posterCompany || o.clientName || 'Unknown',
        description: o.description, source: o.source === 'ats_lever' ? 'Lever' : 'linkedin', createdAt: o.createdAt.toISOString(),
        skills: o.skills, location: o.location, applyEmail: o.applyEmail, applyUrl: o.applyUrl,
        matchLabel: fit.label, aiVerified: false, alreadyApplied: false,
        githubVerified: ghOverlap(fit.matchedSkills),
        matchScore: fit.score, matchedSkills: fit.matchedSkills.slice(0, 4), matchedTitleTokens: fit.matchedTitleTokens,
        languageGap: fit.languageGap, missingCore: fit.missingCore,
      }));
    let pos = queueItems.length + 2;
    for (const it of extraAts) {
      items.splice(Math.min(pos, items.length), 0, it);
      pos += 5;
    }
  }

  // ── Vetted-only branch: replace the lexical tail with ONLY gate-approved direction items.
  // Queue (matcher-approved) stays on top; ATS cards stay (external apply — no gate wall possible).
  let vetStatus: { approved: number; remaining: number; poolSize: number } | null = null;
  if (vettedFeedOn) {
    const vf = await readVettedFeed(session.user.id);
    if (vf) {
      vetStatus = { approved: vf.status.approved, remaining: vf.status.remaining, poolSize: vf.status.poolSize };
      const queueIds2 = new Set(queueItems.map(i => i.id));
      const atsCards = items.filter(i => i.applyUrl && !i.applyEmail && !queueIds2.has(i.id));
      const atsIds = new Set(atsCards.map(i => i.id));
      const dirIds = vf.approvedIds.filter(id => !queueIds2.has(id) && !atsIds.has(id));
      const dirOpps = dirIds.length ? await prisma.opportunity.findMany({
        where: { id: { in: dirIds } },
        select: { id: true, title: true, clientName: true, posterCompany: true, description: true, createdAt: true, skills: true, location: true, applyEmail: true, applyUrl: true, source: true, company: { select: { name: true } } },
      }) : [];
      const dirById = new Map(dirOpps.map(o => [o.id, o]));
      const dirItems = dirIds.map((id) => {
        const o = dirById.get(id); const f = vf.fits.get(id);
        if (!o || !f) return null;
        return {
          id: o.id, type: 'opportunity' as const, title: o.title,
          companyName: o.company?.name || o.posterCompany || o.clientName || 'Unknown',
          description: o.description, source: o.source === 'ats_lever' ? 'Lever' : 'linkedin', createdAt: o.createdAt.toISOString(),
          skills: o.skills, location: o.location, applyEmail: o.applyEmail, applyUrl: o.applyUrl,
          matchLabel: (f.label === 'Weak' ? 'Good' : f.label) as FitLabel, // gate said SEND — at least Good
          aiVerified: true, alreadyApplied: appliedOppIds.has(o.id),
          githubVerified: ghOverlap(f.matchedSkills),
          matchScore: f.score, matchedSkills: f.matchedSkills.slice(0, 4), matchedTitleTokens: f.matchedTitleTokens,
          languageGap: f.languageGap, missingCore: f.missingCore,
        } as FeedItem;
      }).filter(Boolean) as FeedItem[];
      items = [...queueItems, ...dirItems];
      let atsPos = queueItems.length + 2;
      for (const card of atsCards) {
        items.splice(Math.min(atsPos, items.length), 0, card);
        atsPos += 5;
      }
    }
  }

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
          hasApplied={hasApplied}
          loopIds={loopIds}
          autoApplyOn={autoApplyOn}
          vettedFeed={vettedFeedOn}
          vetStatus={vetStatus}
        />
      </div>

    </div>
  );
}
