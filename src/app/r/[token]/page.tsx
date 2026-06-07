import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { computeCaveats } from '@/lib/match-caveats';
import { verifyRecruiterToken } from '@/lib/recruiter-token';
import { RecruiterInboxClient, type RecruiterCandidate } from '@/components/recruiter/RecruiterInboxClient';
import { RecruiterFeedback } from '@/components/recruiter/RecruiterFeedback';
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
// applications were scored by the old buggy matcher (e.g. a Java dev shown for a
// "Medical Interpreter" role) — rather than re-score that backlog, we simply don't show it.
// Move this date earlier to surface more history once the legacy backlog is trustworthy.
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
    where: { appliedToEmail: { equals: email, mode: 'insensitive' }, sentAt: { not: null }, recruiterHidden: false, createdAt: { gte: MATCHER_FIX_CUTOFF } },
    orderBy: [{ matchScore: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true, jobTitle: true, coverLetter: true, matchScore: true, matchLabel: true, createdAt: true,
      jobId: true, opportunityId: true, matchBreakdown: true,
      user: { select: { name: true, parsedProfile: true, resumeUrl: true, lastActiveAt: true, availableFrom: true, portfolioUrl: true, salaryExpectation: true, salaryExpectationAt: true, timezone: true, availability: true, rateFloorHourly: true } },
    },
  });

  await logVisit(email, apps.length);

  // Value-first funnel: show the candidate list immediately (the token already proves inbox
  // control). Registration is deferred to the first ACTION (reply) via an inline form in the
  // client — this fixes the old drop-off where a form gated the list on the very first visit.
  // We only bump lastSeenAt for an already-registered recruiter and never create a row on a
  // mere visit, so "registered" stays a genuine engagement signal captured at reply time.
  const recruiter = await prisma.recruiter.findUnique({ where: { email }, select: { id: true } });
  const needsRegistration = !recruiter;
  if (recruiter) {
    await prisma.recruiter.update({ where: { email }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }

  const candidates: RecruiterCandidate[] = apps.map((a) => {
    const p = (a.user.parsedProfile ?? {}) as Record<string, unknown>;
    const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
    // Always serve the CV through the token-gated route: it redirects to the original PDF
    // (Blob) when stored, or renders an HTML résumé from the parsed profile for legacy
    // candidates whose original file was never persisted. null only when there's nothing.
    const hasBlob = !!a.user.resumeUrl && a.user.resumeUrl.includes('blob.vercel-storage');
    const cvUrl = hasBlob || hasRenderableCv(p as CvProfile) ? `/r/${token}/cv/${a.id}` : null;
    return {
      appId: a.id,
      name: a.user.name || 'Candidate',
      jobTitle: a.jobTitle,
      // §2.1 — same vacancy groups together. Prefer the stable listing id; fall back to title.
      listingKey: a.jobId || a.opportunityId || a.jobTitle,
      // §3 — surface the frozen structural breakdown only when it has real lines
      // (skip null / error / empty / fallback). Shape mirrors buildBreakdown's Line.
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
      ...(() => { const cv = computeCaveats(a.matchBreakdown); return { strength: cv?.strength ?? null, caveats: cv?.items ?? [] }; })(),
      coverLetter: a.coverLetter || '',
      cvUrl,
      // Genuine candidate liveness — auth.ts updates lastActiveAt on real login (throttled),
      // NOT system events. Drives the honest "actively job-seeking" badge (hidden when dormant).
      lastActiveAt: a.user.lastActiveAt ? a.user.lastActiveAt.toISOString() : null,
      profile: {
        current_title: typeof p.current_title === 'string' ? p.current_title : undefined,
        experience_years: typeof p.experience_years === 'number' ? p.experience_years : undefined,
        // Contract/remote recruiters rank timezone + rate above experience (TZ §2.2).
        timezone: a.user.timezone || undefined,
        availabilityHours: a.user.availability || undefined,   // "~30 hrs/week"
        rateFloorHourly: typeof a.user.rateFloorHourly === 'number' ? a.user.rateFloorHourly : undefined,
        summary: typeof p.summary === 'string' ? p.summary : undefined,
        location: typeof p.location === 'string' ? p.location : undefined,
        languages: arr(p.languages),
        skills: arr(p.skills).slice(0, 25),
        availableFrom: a.user.availableFrom || undefined,   // "when can you start" — top recruiter re-ask
        portfolioUrl: a.user.portfolioUrl || undefined,     // portfolio / GitHub / site
        // Candidate-stated expected pay — SELF-REPORTED. Pass the timestamp too so the card
        // labels it as stated, never verified, and de-emphasizes stale values.
        salaryExpectation: a.user.salaryExpectation || undefined,
        salaryExpectationAt: a.user.salaryExpectationAt ? a.user.salaryExpectationAt.toISOString() : undefined,
      },
    };
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'system-ui, sans-serif', color: 'var(--text, #0B0C0F)' }}>
      <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '16px' }}>Freelanly</strong>
          <span className="meta">{email}</span>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '28px 24px 64px' }}>
        <h1 style={{ fontSize: '22px', margin: '0 0 4px' }}>
          {candidates.length} candidate{candidates.length === 1 ? '' : 's'} applied to your roles
        </h1>
        <p className="meta" style={{ margin: '0 0 20px' }}>Sorted by match. Open a candidate to view their profile and CV, reply, or reveal their email to reach them directly.</p>

        {candidates.length > 0 && (() => {
          const roleCount = new Set(candidates.map((c) => c.listingKey)).size;
          const strongCount = candidates.filter((c) => c.strength === 'Strong').length;
          const stats = [
            { n: candidates.length, l: candidates.length === 1 ? 'candidate' : 'candidates' },
            { n: roleCount, l: roleCount === 1 ? 'role' : 'roles' },
            { n: strongCount, l: 'strong match' + (strongCount === 1 ? '' : 'es') },
          ];
          return (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', margin: '0 0 22px' }}>
              {stats.map((s) => (
                <div key={s.l} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', padding: '11px 18px', minWidth: '104px' }}>
                  <div style={{ fontSize: '21px', fontWeight: 700, lineHeight: 1 }}>{s.n}</div>
                  <div className="meta" style={{ fontSize: '11px', marginTop: '4px' }}>{s.l}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {candidates.length > 0 && <RecruiterFeedback token={token} />}

        {candidates.length === 0 ? (
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
            <p className="meta">No applications yet. They’ll appear here as candidates apply to your posts.</p>
          </div>
        ) : (
          <RecruiterInboxClient
            token={token}
            candidates={candidates}
            needsRegistration={needsRegistration}
            email={email}
            prefill={{ company: guessCompany(email), hiringFor: topJobTitle(apps) }}
          />
        )}
      </div>
    </div>
  );
}
