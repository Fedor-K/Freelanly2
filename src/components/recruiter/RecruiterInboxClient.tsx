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
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {candidates.map((c, i) => {
        const open = openId === c.appId;
        const skills = c.profile.skills || [];
        const shown = skills.slice(0, 4);
        const extra = skills.length - shown.length;
        const letter = (c.coverLetter || '').replace(/\s+/g, ' ').trim();
        return (
          <div key={c.appId} className="card" style={{ padding: '11px 14px' }}>
            {/* Compact header row */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div className="avatar" style={{ background: AV_COLORS[i % AV_COLORS.length], width: '30px', height: '30px', fontSize: '11px', flexShrink: 0 }}>
                {c.name.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
                  <span className="name" style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                  {c.fit && <span className="chip" style={{ height: '17px', padding: '0 7px', fontSize: '9.5px', flexShrink: 0 }}>{c.fit}</span>}
                  <span className="meta" style={{ fontSize: '11px', marginLeft: 'auto', flexShrink: 0 }}>{timeAgo(c.createdAt)}</span>
                </div>
                <div className="meta" style={{ fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.jobTitle}</div>
              </div>
            </div>

            {/* Skills — one tight line */}
            {shown.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px', alignItems: 'center' }}>
                {shown.map((s, j) => (
                  <span key={j} className="chip" style={{ height: '19px', padding: '0 7px', fontSize: '10px', background: 'var(--bg-2)' }}>{s}</span>
                ))}
                {extra > 0 && <span className="meta" style={{ fontSize: '10.5px' }}>+{extra}</span>}
              </div>
            )}

            {/* Action bar — always visible */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
              {sent[c.appId] ? (
                <span className="meta" style={{ fontSize: '12px', color: '#2e7d32' }}>✓ Reply sent</span>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => setOpenId(open ? null : c.appId)}>
                  💬 Reply
                </button>
              )}
              {c.cvUrl && (
                <a href={c.cvUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">📄 CV</a>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setOpenId(open ? null : c.appId)}>
                {open ? 'Hide' : '👤 Profile'}
              </button>
            </div>

            {/* Expanded: full profile + their message + reply box */}
            {open && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12.5px', marginBottom: '10px' }}>
                  {c.profile.current_title && <div><div className="meta" style={{ fontSize: '10px' }}>Title</div>{c.profile.current_title}</div>}
                  {typeof c.profile.experience_years === 'number' && c.profile.experience_years > 0 && <div><div className="meta" style={{ fontSize: '10px' }}>Experience</div>{c.profile.experience_years} yrs</div>}
                  {c.profile.location && <div><div className="meta" style={{ fontSize: '10px' }}>Location</div>{c.profile.location}</div>}
                  {c.profile.languages && c.profile.languages.length > 0 && <div><div className="meta" style={{ fontSize: '10px' }}>Languages</div>{c.profile.languages.join(', ')}</div>}
                </div>
                {skills.length > shown.length && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                    {skills.map((s, j) => <span key={j} className="chip" style={{ height: '19px', padding: '0 7px', fontSize: '10px', background: 'var(--bg-2)' }}>{s}</span>)}
                  </div>
                )}
                {c.profile.summary && <p style={{ fontSize: '12.5px', lineHeight: 1.55, margin: '0 0 10px', color: '#444' }}>{c.profile.summary}</p>}
                <div className="meta" style={{ fontSize: '10px', marginBottom: '3px' }}>Their message</div>
                <p style={{ fontSize: '12.5px', lineHeight: 1.55, margin: '0 0 12px', whiteSpace: 'pre-wrap', color: '#333' }}>{letter}</p>

                {sent[c.appId] ? (
                  <div className="meta" style={{ fontSize: '12.5px', color: '#2e7d32', padding: '4px 0' }}>✓ Reply sent — {c.name.split(' ')[0]} will see it on their dashboard.</div>
                ) : (
                  <div>
                    <textarea
                      value={draft[c.appId] || ''}
                      onChange={(e) => setDraft((d) => ({ ...d, [c.appId]: e.target.value }))}
                      placeholder={`Reply to ${c.name.split(' ')[0]}…`}
                      rows={3}
                      style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '7px' }}>
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
