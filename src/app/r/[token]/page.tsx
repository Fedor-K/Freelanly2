import type { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { verifyRecruiterToken } from '@/lib/recruiter-token';
import '../../design-app.css';

export const metadata: Metadata = {
  title: 'Your Candidates — Freelanly',
  robots: { index: false, follow: false },
};

const AV_COLORS = ['#FF6B6B', '#A8E024', '#6EE7FF', '#FFB951', '#A78BFA', '#34D399', '#F87171', '#818CF8'];

function timeAgo(d: Date | null): string {
  if (!d) return '';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

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
    where: { appliedToEmail: { equals: email, mode: 'insensitive' }, sentAt: { not: null } },
    orderBy: [{ matchScore: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true, jobTitle: true, companyName: true, coverLetter: true,
      matchScore: true, matchLabel: true, status: true, createdAt: true, repliedAt: true,
      user: { select: { name: true, parsedProfile: true, resumeUrl: true } },
    },
  });

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'system-ui, sans-serif', color: 'var(--text, #0B0C0F)' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <strong style={{ fontSize: '16px' }}>Freelanly</strong>
          <span className="meta">{email}</span>
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '28px 24px 64px' }}>
        <h1 style={{ fontSize: '22px', margin: '0 0 4px' }}>
          {apps.length} candidate{apps.length === 1 ? '' : 's'} applied to your roles
        </h1>
        <p className="meta" style={{ margin: '0 0 24px' }}>Sorted by match. Sent to you via Freelanly.</p>

        {apps.length === 0 && (
          <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
            <p className="meta">No applications yet. They’ll appear here as candidates apply to your posts.</p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {apps.map((a, i) => {
            const profile = (a.user.parsedProfile ?? {}) as { skills?: unknown };
            const skills = Array.isArray(profile.skills) ? (profile.skills as unknown[]).map(String).slice(0, 6) : [];
            const hasCv = !!a.user.resumeUrl && a.user.resumeUrl.includes('blob.vercel-storage');
            const name = a.user.name || 'Candidate';
            const fit = a.matchLabel || (a.matchScore != null ? `${a.matchScore}% match` : null);
            const letter = (a.coverLetter || '').replace(/\s+/g, ' ').trim().slice(0, 240);
            return (
              <div key={a.id} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div className="avatar" style={{ background: AV_COLORS[i % AV_COLORS.length], width: '40px', height: '40px', fontSize: '13px', flexShrink: 0 }}>
                    {name.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                      <span className="name" style={{ fontSize: '15px', fontWeight: 600 }}>{name}</span>
                      <span className="meta" style={{ fontSize: '11px', flexShrink: 0 }}>{timeAgo(a.createdAt)}</span>
                    </div>
                    <div className="meta" style={{ fontSize: '12.5px', marginTop: '1px' }}>
                      applied to <strong>{a.jobTitle}</strong>
                      {fit && <span className="chip" style={{ marginLeft: '8px', height: '18px', padding: '0 8px', fontSize: '10px' }}>{fit}</span>}
                    </div>
                    {skills.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                        {skills.map((s, j) => (
                          <span key={j} className="chip" style={{ height: '20px', padding: '0 8px', fontSize: '10.5px', background: 'var(--bg-2)' }}>{s}</span>
                        ))}
                      </div>
                    )}
                    {letter && (
                      <p className="meta" style={{ fontSize: '12.5px', lineHeight: 1.5, marginTop: '10px' }}>{letter}{letter.length >= 240 ? '…' : ''}</p>
                    )}
                    {hasCv && (
                      <a href={a.user.resumeUrl!} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: '10px', display: 'inline-flex' }}>
                        View CV
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
