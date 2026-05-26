'use client';

import { useState } from 'react';

export type RecruiterCandidate = {
  appId: string;
  name: string;
  jobTitle: string;
  createdAt: string;
  fit: string | null;
  coverLetter: string;
  cvUrl: string | null;
  profile: {
    current_title?: string;
    experience_years?: number;
    summary?: string;
    location?: string;
    languages?: string[];
    skills?: string[];
  };
};

const AV_COLORS = ['#FF6B6B', '#A8E024', '#6EE7FF', '#FFB951', '#A78BFA', '#34D399', '#F87171', '#818CF8'];

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function RecruiterInboxClient({ token, candidates }: { token: string; candidates: RecruiterCandidate[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<Record<string, string>>({});

  async function send(appId: string) {
    const message = (draft[appId] || '').trim();
    if (!message) return;
    setSending(appId);
    setErr((e) => ({ ...e, [appId]: '' }));
    try {
      const res = await fetch('/api/recruiter/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, applicationId: appId, message }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSent((s) => ({ ...s, [appId]: true }));
        setDraft((d) => ({ ...d, [appId]: '' }));
      } else {
        setErr((e) => ({ ...e, [appId]: data.error || 'Failed to send' }));
      }
    } catch {
      setErr((e) => ({ ...e, [appId]: 'Network error' }));
    } finally {
      setSending(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {candidates.map((c, i) => {
        const open = openId === c.appId;
        const skills = c.profile.skills || [];
        const collapsedSkills = skills.slice(0, 6);
        const letter = (c.coverLetter || '').replace(/\s+/g, ' ').trim();
        return (
          <div key={c.appId} className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => setOpenId(open ? null : c.appId)}>
              <div className="avatar" style={{ background: AV_COLORS[i % AV_COLORS.length], width: '40px', height: '40px', fontSize: '13px', flexShrink: 0 }}>
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px' }}>
                  <span className="name" style={{ fontSize: '15px', fontWeight: 600 }}>{c.name}</span>
                  <span className="meta" style={{ fontSize: '11px', flexShrink: 0 }}>{timeAgo(c.createdAt)}</span>
                </div>
                <div className="meta" style={{ fontSize: '12.5px', marginTop: '1px' }}>
                  applied to <strong>{c.jobTitle}</strong>
                  {c.fit && <span className="chip" style={{ marginLeft: '8px', height: '18px', padding: '0 8px', fontSize: '10px' }}>{c.fit}</span>}
                </div>
                {(open ? skills : collapsedSkills).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {(open ? skills : collapsedSkills).map((s, j) => (
                      <span key={j} className="chip" style={{ height: '20px', padding: '0 8px', fontSize: '10.5px', background: 'var(--bg-2)' }}>{s}</span>
                    ))}
                  </div>
                )}
                {!open && letter && (
                  <p className="meta" style={{ fontSize: '12.5px', lineHeight: 1.5, marginTop: '10px' }}>{letter.slice(0, 200)}{letter.length > 200 ? '…' : ''}</p>
                )}
                {!open && <div className="meta" style={{ fontSize: '11px', marginTop: '8px', color: 'var(--accent, #0B0C0F)' }}>Open profile &amp; reply →</div>}
              </div>
            </div>

            {open && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
                {/* Full profile */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12.5px', marginBottom: '12px' }}>
                  {c.profile.current_title && <div><div className="meta" style={{ fontSize: '10px' }}>Title</div>{c.profile.current_title}</div>}
                  {typeof c.profile.experience_years === 'number' && c.profile.experience_years > 0 && <div><div className="meta" style={{ fontSize: '10px' }}>Experience</div>{c.profile.experience_years} yrs</div>}
                  {c.profile.location && <div><div className="meta" style={{ fontSize: '10px' }}>Location</div>{c.profile.location}</div>}
                  {c.profile.languages && c.profile.languages.length > 0 && <div><div className="meta" style={{ fontSize: '10px' }}>Languages</div>{c.profile.languages.join(', ')}</div>}
                </div>
                {c.profile.summary && <p style={{ fontSize: '13px', lineHeight: 1.6, margin: '0 0 12px', color: '#444' }}>{c.profile.summary}</p>}

                {/* Cover letter */}
                <div className="meta" style={{ fontSize: '10px', marginBottom: '4px' }}>Their message</div>
                <p style={{ fontSize: '13px', lineHeight: 1.6, margin: '0 0 14px', whiteSpace: 'pre-wrap', color: '#333' }}>{letter}</p>

                {c.cvUrl && (
                  <a href={c.cvUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', marginBottom: '14px' }}>
                    Download CV
                  </a>
                )}

                {/* Reply box */}
                {sent[c.appId] ? (
                  <div className="meta" style={{ fontSize: '13px', color: '#2e7d32', padding: '10px 0' }}>✓ Reply sent — {c.name.split(' ')[0]} will see it on their dashboard.</div>
                ) : (
                  <div>
                    <textarea
                      value={draft[c.appId] || ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [c.appId]: e.target.value }))}
                      placeholder={`Reply to ${c.name.split(' ')[0]}…`}
                      rows={3}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => send(c.appId)} disabled={sending === c.appId || !(draft[c.appId] || '').trim()}>
                        {sending === c.appId ? 'Sending…' : 'Send reply'}
                      </button>
                      {err[c.appId] && <span className="meta" style={{ fontSize: '12px', color: '#c0392b' }}>{err[c.appId]}</span>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
