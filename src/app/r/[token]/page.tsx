import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { computeCaveats, reconcileScore } from '@/lib/match-caveats';
import { cleanReplyText } from '@/lib/clean-reply';
import { verifyRecruiterToken } from '@/lib/recruiter-token';
import { RecruiterLanding, type AnonCandidate } from './RecruiterLanding';
import { cleanDisplayName, type RecruiterCandidate } from '@/components/recruiter/cabinet/lib';
import { hasRenderableCv, type CvProfile } from '@/lib/recruiter-cv';
import '../../design-app.css';
import '../recruiter.css';

// Fire-and-forget visit log (top of the demand funnel) — deduped per recruiter ~5 min so
// email link-scanners / double renders don't inflate the count. Never blocks the page.
async function logVisit(email: string, candidateCount: number) {
  try {
    const recent = await prisma.activityLog.findFirst({
      where: {
        action: 'RECRUITER_PORTAL_VISIT',
        details: { path: ['recruiterEmail'], equals: email },
        createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recent) return;
    const h = await headers();
    await prisma.activityLog.create({
      data: {
        action: 'RECRUITER_PORTAL_VISIT',
        details: { recruiterEmail: email, candidateCount },
        ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
        userAgent: h.get('user-agent') || null,
        country: h.get('x-vercel-ip-country') || null,
      },
    });
  } catch {
    /* logging must never break the page */
  }
}

export const metadata: Metadata = {
  title: 'Your Candidates — Freelanly',
  robots: { index: false, follow: false },
};

// Pre-fill the registration form from what we already know, so it's near-zero effort.
const FREE_EMAIL = new Set(['gmail.com', 'googlemail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'zohomail.com', 'proton.me', 'gmx.com', 'mail.com', 'yandex.ru']);
function guessCompany(email: string): string {
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!domain || FREE_EMAIL.has(domain)) return '';
  const label = domain.split('.')[0] || '';
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
}
function topJobTitle(apps: { jobTitle: string }[]): string {
  const counts = new Map<string, number>();
  for (const a of apps) if (a.jobTitle) counts.set(a.jobTitle, (counts.get(a.jobTitle) || 0) + 1);
  let best = '';
  let max = 0;
  for (const [title, n] of counts) if (n > max) { max = n; best = title; }
  return best;
}

// Only show candidates from AFTER the matcher-quality fix went live. Pre-fix (legacy)
// applications were scored by the old buggy matcher — rather than re-score that backlog, we
// don't show it. Move this date earlier to surface more history once it's trustworthy.
const MATCHER_FIX_CUTOFF = new Date('2026-05-26T00:00:00Z');

interface Props {
  params: Promise<{ token: string }>;
}

export default async function RecruiterCandidatesPage({ params }: Props) {
  const { token } = await params;
  const email = verifyRecruiterToken(token);

  if (!email) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div className="card" style={{ padding: '32px', maxWidth: '420px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px' }}>Link expired or invalid</h2>
          <p className="meta">Open this page from the link in your candidate-application email.</p>
        </div>
      </div>
    );
  }

  const apps = await prisma.autoApplication.findMany({
    // Show real candidate applications (sentAt set) AND demand-side shortlist cards we pushed to this
    // company (origin='SHORTLIST', sentAt intentionally NULL so they don't count as candidate sends).
    where: {
      appliedToEmail: { equals: email, mode: 'insensitive' }, recruiterHidden: false, createdAt: { gte: MATCHER_FIX_CUTOFF },
      OR: [{ sentAt: { not: null } }, { origin: 'SHORTLIST' }],
    },
    orderBy: [{ matchScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true, jobTitle: true, coverLetter: true, matchScore: true, matchLabel: true, createdAt: true,
      jobId: true, opportunityId: true, matchBreakdown: true, status: true, repliedAt: true, replyText: true,
      user: { select: { name: true, image: true, parsedProfile: true, resumeUrl: true, lastActiveAt: true, availableFrom: true, portfolioUrl: true, salaryExpectation: true, salaryExpectationAt: true, timezone: true, availability: true, rateFloorHourly: true, githubUrl: true, githubReview: { select: { verdict: true } } } },
    },
  });

  await logVisit(email, apps.length);

  // Already-registered recruiter → bump lastSeenAt (engagement signal). We never create a row on a
  // mere visit, so "registered" stays genuine.
  const recruiter = await prisma.recruiter.findUnique({ where: { email }, select: { company: true } });
  if (recruiter) {
    await prisma.recruiter.update({ where: { email }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }

  const candidates: RecruiterCandidate[] = apps.map((a) => {
    const p = (a.user.parsedProfile ?? {}) as Record<string, unknown>;
    const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
    const hasBlob = !!a.user.resumeUrl && a.user.resumeUrl.includes('blob.vercel-storage');
    const cvUrl = hasBlob || hasRenderableCv(p as CvProfile) ? `/r/${token}/cv/${a.id}` : null;
    return {
      appId: a.id,
      name: cleanDisplayName(a.user.name || 'Candidate'),
      avatarUrl: a.user.image ? `/r/${token}/avatar/${a.id}` : null, // proxied (licdn can't be hot-linked)
      jobTitle: a.jobTitle,
      listingKey: a.jobId || a.opportunityId || a.jobTitle,
      matchBreakdown: (() => {
        const b = a.matchBreakdown as Record<string, unknown> | null;
        if (!b || typeof b !== 'object' || b.error) return undefined;
        const rawLines = Array.isArray(b.lines) ? b.lines : [];
        if (rawLines.length === 0) return undefined;
        const lines = rawLines.map((l) => {
          const ln = (l ?? {}) as Record<string, unknown>;
          return {
            label: String(ln.label ?? ''),
            type: ln.type === 'language' ? ('language' as const) : ('skill' as const),
            status: ln.status === 'full' ? ('full' as const) : ('missing' as const),
            evidence: typeof ln.evidence === 'string' ? ln.evidence : null,
          };
        }).filter((l) => l.label);
        if (lines.length === 0) return undefined;
        return {
          matched: typeof b.matched === 'number' ? b.matched : lines.filter((l) => l.status === 'full').length,
          total: typeof b.total === 'number' ? b.total : lines.length,
          lines,
        };
      })(),
      createdAt: a.createdAt.toISOString(),
      fit: a.matchLabel || (a.matchScore != null ? `${a.matchScore}% match` : null),
      // Reconcile the fit-ring number to the LIVE-recomputed strength (same computeCaveats the badge
      // uses), so historical records with an inflated stored score can't show "Weak" + ring "80".
      score: reconcileScore(a.matchScore, computeCaveats(a.matchBreakdown)?.strength ?? null),
      status: a.status || 'SENT',
      repliedAt: a.repliedAt ? a.repliedAt.toISOString() : null,
      replyPreview: a.replyText ? cleanReplyText(a.replyText).slice(0, 160) : null,
      ...(() => { const cv = computeCaveats(a.matchBreakdown); return { strength: cv?.strength ?? null, caveats: cv?.items ?? [] }; })(),
      coverLetter: a.coverLetter || '',
      cvUrl,
      lastActiveAt: a.user.lastActiveAt ? a.user.lastActiveAt.toISOString() : null,
      profile: {
        current_title: typeof p.current_title === 'string' ? p.current_title : undefined,
        experience_years: typeof p.experience_years === 'number' ? p.experience_years : undefined,
        timezone: a.user.timezone || undefined,
        availabilityHours: a.user.availability || undefined,
        rateFloorHourly: typeof a.user.rateFloorHourly === 'number' ? a.user.rateFloorHourly : undefined,
        summary: typeof p.summary === 'string' ? p.summary : undefined,
        location: typeof p.location === 'string' ? p.location : undefined,
        languages: arr(p.languages),
        skills: arr(p.skills).slice(0, 25),
        availableFrom: a.user.availableFrom || undefined,
        portfolioUrl: a.user.portfolioUrl || undefined,
        salaryExpectation: a.user.salaryExpectation || undefined,
        salaryExpectationAt: a.user.salaryExpectationAt ? a.user.salaryExpectationAt.toISOString() : undefined,
      },
    };
  });

  // Anonymized, PII-free view for the landing (no name / avatar / CV / cover letter / contact reach
  // the client — those are the "introduce me" reward, not the teaser). Screening facts recruiters ask
  // for (years, timezone, start-date, availability, expected pay, verified-GitHub/portfolio badges).
  const anon: AnonCandidate[] = candidates.map((c, i) => {
    const u = apps[i].user;
    const verified = u.githubReview?.verdict === 'STRONG' || u.githubReview?.verdict === 'ACTIVE';
    const bd = apps[i].matchBreakdown as Record<string, unknown> | null;
    const whyFit = bd && typeof bd.recruiterReasoning === 'string' ? bd.recruiterReasoning : null;
    return {
      appId: c.appId,
      profession: c.profile.current_title || c.jobTitle || 'Candidate',
      location: c.profile.location || null,
      whyFit,
      strength: c.strength || (c.fit && /strong|good|weak/i.test(c.fit) ? c.fit.replace(/\s*match.*/i, '') : null),
      years: c.profile.experience_years ?? null,
      skills: c.profile.skills || [],
      matched: c.matchBreakdown?.matched ?? null,
      total: c.matchBreakdown?.total ?? null,
      availability: u.availability || null,
      availableFrom: u.availableFrom || null,
      salaryExpectation: u.salaryExpectation || null,
      timezone: u.timezone || null,
      githubVerified: verified,
      hasPortfolio: !!u.portfolioUrl,
    };
  });

  const company = recruiter?.company || guessCompany(email);
  const role = topJobTitle(apps);

  return <RecruiterLanding token={token} company={company} role={role} candidates={anon} />;
}
