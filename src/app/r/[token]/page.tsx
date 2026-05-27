import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';
import { RecruiterInboxClient, type RecruiterCandidate } from '@/components/recruiter/RecruiterInboxClient';
import '../../design-app.css';

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
      user: { select: { name: true, parsedProfile: true, resumeUrl: true } },
    },
  });

  await logVisit(email, apps.length);

  const candidates: RecruiterCandidate[] = apps.map((a) => {
    const p = (a.user.parsedProfile ?? {}) as Record<string, unknown>;
    const arr = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
    return {
      appId: a.id,
      name: a.user.name || 'Candidate',
      jobTitle: a.jobTitle,
      createdAt: a.createdAt.toISOString(),
      fit: a.matchLabel || (a.matchScore != null ? `${a.matchScore}% match` : null),
      coverLetter: a.coverLetter || '',
      cvUrl: a.user.resumeUrl && a.user.resumeUrl.includes('blob.vercel-storage') ? a.user.resumeUrl : null,
      profile: {
        current_title: typeof p.current_title === 'string' ? p.current_title : undefined,
        experience_years: typeof p.experience_years === 'number' ? p.experience_years : undefined,
        summary: typeof p.summary === 'string' ? p.summary : undefined,
        location: typeof p.location === 'string' ? p.location : undefined,
        languages: arr(p.languages),
        skills: arr(p.skills).slice(0, 25),
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
        <p className="meta" style={{ margin: '0 0 24px' }}>Sorted by match. Click a candidate to see their profile, CV, and reply.</p>

        {candidates.length === 0 ? (
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
            <p className="meta">No applications yet. They’ll appear here as candidates apply to your posts.</p>
          </div>
        ) : (
          <RecruiterInboxClient token={token} candidates={candidates} />
        )}
      </div>
    </div>
  );
}
