'use client';

import { useState, type CSSProperties } from 'react';

export type RecruiterCandidate = {
  appId: string;
  name: string;
  jobTitle: string;
  createdAt: string;
  fit: string | null;
  coverLetter: string;
  cvUrl: string | null;
  lastActiveAt: string | null;
  profile: {
    current_title?: string;
    experience_years?: number;
    timezone?: string;
    availabilityHours?: string;     // "~30 hrs/week"
    rateFloorHourly?: number;       // candidate's stated minimum $/hr
    summary?: string;
    location?: string;
    languages?: string[];
    skills?: string[];
    availableFrom?: string;   // "when can you start" — candidate-stated
    portfolioUrl?: string;    // portfolio / GitHub / site
    salaryExpectation?: string;     // candidate-stated expected pay (SELF-REPORTED, e.g. "USD 1,500/mo")
    salaryExpectationAt?: string;   // when stated — de-emphasize / flag if stale
  };
};

type Msg = { from: string; text: string; at: string };

const AV_COLORS = ['#FF6B6B', '#A8E024', '#6EE7FF', '#FFB951', '#A78BFA', '#34D399', '#F87171', '#818CF8'];

// Inline registration (shown at first reply, value-first funnel).
const REG_VOLUMES = ['1', '2-5', '6-20', '20+'] as const;
const REG_LABEL: CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 600, margin: '0 0 5px', color: '#0B0C0F' };
const REG_INPUT: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E8E5DC', borderRadius: '9px', fontSize: '14px' };

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d`;
  return `${Math.floor(days / 30)}mo`;
}

function shortTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

// Honest liveness badge: ONLY when the candidate genuinely logged in recently (lastActiveAt).
// Dormant (>7d or never) → null → hide the badge entirely (a bare "matched" is table-stakes
// noise — every candidate here was matched). No "actively seeking" claim on a stale account.
function freshness(iso: string | null): { label: string; color: string } | null {
  if (!iso) return null;
  const h = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (h > 24 * 7) return null; // dormant → hide
  const ago = h < 1 ? 'just now' : h < 24 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;
  // "actively job-seeking" only ≤72h — claiming "actively now" on a 6-day-old login is a stretch.
  if (h <= 72) return { label: `Actively job-seeking · active ${ago}`, color: h < 24 ? '#2e7d32' : '#b07d00' };
  return { label: `Active ${ago}`, color: '#6b7280' }; // 3-7d: neutral liveness, no "actively" claim
}

export function RecruiterInboxClient({
  token,
  candidates,
  needsRegistration = false,
  email = '',
  prefill = { company: '', hiringFor: '' },
}: {
  token: string;
  candidates: RecruiterCandidate[];
  needsRegistration?: boolean;
  email?: string;
  prefill?: { company: string; hiringFor: string };
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [sending, setSending] = useState<string | null>(null);
  const [err, setErr] = useState<Record<string, string>>({});
  const [threads, setThreads] = useState<Record<string, Msg[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Value-first funnel: an unregistered recruiter sees the candidate list immediately and is
  // asked to register only when they take an action (reply). `registered` flips after the inline
  // form succeeds, after which the pending reply is sent automatically.
  const [registered, setRegistered] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const [pendingReplyAppId, setPendingReplyAppId] = useState<string | null>(null);
  const [regName, setRegName] = useState('');
  const [regCompany, setRegCompany] = useState(prefill.company);
  const [regHiringFor, setRegHiringFor] = useState(prefill.hiringFor);
  const [regVol, setRegVol] = useState('');
  const [regSaving, setRegSaving] = useState(false);
  const [regErr, setRegErr] = useState('');

  async function loadThread(appId: string) {
    if (threads[appId] || loading[appId]) return;
    setLoading((l) => ({ ...l, [appId]: true }));
    try {
      const res = await fetch(`/api/recruiter/thread?token=${encodeURIComponent(token)}&appId=${encodeURIComponent(appId)}`);
      const data = await res.json();
      setThreads((t) => ({ ...t, [appId]: Array.isArray(data.thread) ? data.thread : [] }));
    } catch {
      setThreads((t) => ({ ...t, [appId]: [] }));
    } finally {
      setLoading((l) => ({ ...l, [appId]: false }));
    }
  }

  function track(event: string, appId?: string) {
    fetch('/api/recruiter/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, event, appId }),
    }).catch(() => {});
  }

  function toggle(appId: string) {
    const next = openId === appId ? null : appId;
    setOpenId(next);
    track(next ? 'open_chat' : 'close_chat', appId);
    if (next) loadThread(appId);
  }

  // Gate the reply on registration only at action time (value-first). Viewing the profile/CV
  // stays free — the recruiter has already seen the value before being asked to register.
  function send(appId: string) {
    const message = (draft[appId] || '').trim();
    if (!message) return;
    if (needsRegistration && !registered) {
      setPendingReplyAppId(appId);
      setRegErr('');
      setRegOpen(true);
      return;
    }
    void doSend(appId);
  }

  async function doSend(appId: string) {
    const message = (draft[appId] || '').trim();
    if (!message) return;
    track('send_click', appId);
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
        setThreads((t) => ({ ...t, [appId]: [...(t[appId] || []), { from: 'recruiter', text: message, at: new Date().toISOString() }] }));
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

  // First-touch registration, asked at reply time. Token already proves inbox control → no OTP.
  // On success, immediately send the reply the recruiter was trying to send.
  async function completeRegistration() {
    if (regSaving) return;
    setRegSaving(true);
    setRegErr('');
    try {
      const r = await fetch('/api/recruiter/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name: regName, company: regCompany, hiringFor: regHiringFor, hiringVolume: regVol }),
      });
      if (!r.ok) throw new Error();
      setRegistered(true);
      setRegOpen(false);
      const pid = pendingReplyAppId;
      setPendingReplyAppId(null);
      if (pid) void doSend(pid);
    } catch {
      setRegErr('Something went wrong — try again.');
    } finally {
      setRegSaving(false);
    }
  }

  return (
    <>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {candidates.map((c, i) => {
        const open = openId === c.appId;
        const skills = c.profile.skills || [];
        const shown = skills.slice(0, 4);
        const extra = skills.length - shown.length;
        const thread = threads[c.appId] || [];
        const firstName = c.name.split(' ')[0];
        const fr = freshness(c.lastActiveAt);
        return (
          <div key={c.appId} className="card" style={{ padding: '11px 14px' }}>
            {/* Compact header */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggle(c.appId)}>
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
                {fr && (
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: fr.color, borderRadius: '5px', padding: '2px 7px', whiteSpace: 'nowrap' }}>{fr.label}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Skills line */}
            {shown.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '8px', alignItems: 'center' }}>
                {shown.map((s, j) => <span key={j} className="chip" style={{ height: '19px', padding: '0 7px', fontSize: '10px', background: 'var(--bg-2)' }}>{s}</span>)}
                {extra > 0 && <span className="meta" style={{ fontSize: '10.5px' }}>+{extra}</span>}
              </div>
            )}

            {/* Action bar */}
            <div style={{ display: 'flex', gap: '6px', marginTop: '10px', alignItems: 'center' }}>
              <button className="btn btn-primary btn-sm" onClick={() => toggle(c.appId)}>💬 {open ? 'Hide' : 'Open chat'}</button>
              {c.cvUrl && <a href={c.cvUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" onClick={() => track('view_cv', c.appId)}>📄 CV</a>}
            </div>

            {/* Expanded: profile + chat + compose */}
            {open && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
                {/* Profile facts */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12.5px', marginBottom: '10px' }}>
                  {c.profile.current_title && <div><div className="meta" style={{ fontSize: '10px' }}>Title</div>{c.profile.current_title}</div>}
                  {c.profile.timezone && <div><div className="meta" style={{ fontSize: '10px' }}>Timezone</div>{c.profile.timezone}</div>}
                  {c.profile.availabilityHours && <div><div className="meta" style={{ fontSize: '10px' }}>Availability</div>{c.profile.availabilityHours}</div>}
                  {typeof c.profile.rateFloorHourly === 'number' && c.profile.rateFloorHourly > 0 && <div title="Candidate's stated minimum hourly rate"><div className="meta" style={{ fontSize: '10px' }}>Rate (from)</div>${c.profile.rateFloorHourly}/hr</div>}
                  {typeof c.profile.experience_years === 'number' && c.profile.experience_years > 0 && <div><div className="meta" style={{ fontSize: '10px' }}>Experience</div>{c.profile.experience_years} yrs</div>}
                  {c.profile.location && <div><div className="meta" style={{ fontSize: '10px' }}>Location</div>{c.profile.location}</div>}
                  {c.profile.languages && c.profile.languages.length > 0 && <div><div className="meta" style={{ fontSize: '10px' }}>Languages</div>{c.profile.languages.join(', ')}</div>}
                  {c.profile.availableFrom && <div><div className="meta" style={{ fontSize: '10px' }}>Can start</div>{c.profile.availableFrom}</div>}
                  {c.profile.portfolioUrl && <div><div className="meta" style={{ fontSize: '10px' }}>Portfolio</div><a href={c.profile.portfolioUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('view_cv', c.appId)} style={{ color: '#2563eb' }}>Link ↗</a></div>}
                  {c.profile.salaryExpectation && (() => {
                    // Self-reported expected pay. Labelled "stated", never presented as verified.
                    // Stale self-reports (>90d) get an age suffix + muting (same freshness discipline as elsewhere).
                    const stale = c.profile.salaryExpectationAt && (Date.now() - new Date(c.profile.salaryExpectationAt).getTime()) > 90 * 86400000;
                    return (
                      <div title="Candidate-stated, self-reported — not verified">
                        <div className="meta" style={{ fontSize: '10px' }}>Wants (stated)</div>
                        <span style={{ opacity: stale ? 0.55 : 1 }}>{c.profile.salaryExpectation}</span>
                        {stale && c.profile.salaryExpectationAt && <span style={{ color: '#8A8780' }}> · {timeAgo(c.profile.salaryExpectationAt)} ago</span>}
                      </div>
                    );
                  })()}
                </div>
                {c.profile.summary && <p style={{ fontSize: '12.5px', lineHeight: 1.55, margin: '0 0 12px', color: '#444' }}>{c.profile.summary}</p>}

                {/* Chat thread */}
                <div style={{ background: 'var(--bg-2)', borderRadius: '12px', padding: '12px', maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {loading[c.appId] && thread.length === 0 ? (
                    <div className="meta" style={{ fontSize: '12px', textAlign: 'center', padding: '12px' }}>Loading conversation…</div>
                  ) : thread.length === 0 ? (
                    <div className="meta" style={{ fontSize: '12px', textAlign: 'center', padding: '12px' }}>No messages yet.</div>
                  ) : (
                    thread.map((m, j) => {
                      if (m.from === 'system') {
                        return <div key={j} className="meta" style={{ fontSize: '10.5px', textAlign: 'center', padding: '2px 0' }}>{m.text}</div>;
                      }
                      const mine = m.from === 'recruiter';
                      return (
                        <div key={j} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                          <div style={{
                            background: mine ? '#0B0C0F' : '#FFFFFF',
                            color: mine ? '#fff' : '#1a1a1a',
                            border: mine ? 'none' : '1px solid var(--line)',
                            borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                            padding: '8px 12px', fontSize: '13px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          }}>{m.text}</div>
                          <div className="meta" style={{ fontSize: '9.5px', marginTop: '2px', textAlign: mine ? 'right' : 'left' }}>
                            {mine ? 'You' : firstName} · {shortTime(m.at)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Compose */}
                <div style={{ marginTop: '10px' }}>
                  <textarea
                    value={draft[c.appId] || ''}
                    onChange={(e) => setDraft((d) => ({ ...d, [c.appId]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(c.appId); } }}
                    placeholder={`Message ${firstName}…  (⌘/Ctrl+Enter to send)`}
                    rows={2}
                    style={{ width: '100%', padding: '9px 11px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '7px' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => send(c.appId)} disabled={sending === c.appId || !(draft[c.appId] || '').trim()}>
                      {sending === c.appId ? 'Sending…' : 'Send'}
                    </button>
                    {err[c.appId] && <span className="meta" style={{ fontSize: '12px', color: '#c0392b' }}>{err[c.appId]}</span>}
                    <span className="meta" style={{ fontSize: '10.5px', marginLeft: 'auto' }}>Routed to {firstName}’s dashboard</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>

    {regOpen && (
      <div onClick={() => { if (!regSaving) setRegOpen(false); }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 50 }}>
        <div className="card" onClick={(e) => e.stopPropagation()} style={{ padding: '22px', maxWidth: '420px', width: '100%' }}>
          <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>One quick step to reply</h3>
          <p className="meta" style={{ margin: '0 0 16px', fontSize: '13px' }}>A few details and your message goes straight to the candidate. No password needed.</p>
          <div style={{ marginBottom: '12px' }}>
            <span style={REG_LABEL}>Your email</span>
            <input value={email} readOnly disabled style={{ ...REG_INPUT, background: '#F6F5F1', color: '#8A8780' }} />
          </div>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <div style={{ flex: 1 }}><label style={REG_LABEL}>Your name</label><input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Jane" style={REG_INPUT} /></div>
            <div style={{ flex: 1 }}><label style={REG_LABEL}>Company</label><input value={regCompany} onChange={(e) => setRegCompany(e.target.value)} placeholder="Acme" style={REG_INPUT} /></div>
          </div>
          <div style={{ marginBottom: '12px' }}><label style={REG_LABEL}>What are you hiring for?</label><input value={regHiringFor} onChange={(e) => setRegHiringFor(e.target.value)} placeholder="e.g. React developer, Interpreter" style={REG_INPUT} /></div>
          <div style={{ marginBottom: '18px' }}>
            <label style={REG_LABEL}>How many people are you looking to hire?</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {REG_VOLUMES.map((v) => (
                <button key={v} onClick={() => setRegVol(v)} style={{ flex: 1, padding: '8px 0', borderRadius: '9px', fontSize: '14px', cursor: 'pointer', border: regVol === v ? '1.5px solid #0B0C0F' : '1px solid #E8E5DC', background: regVol === v ? '#0B0C0F' : '#fff', color: regVol === v ? '#fff' : '#0B0C0F', fontWeight: regVol === v ? 600 : 400 }}>{v}</button>
              ))}
            </div>
          </div>
          <button onClick={completeRegistration} disabled={regSaving} className="btn" style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 600, background: '#0B0C0F', color: '#fff', border: 0, borderRadius: '10px', cursor: regSaving ? 'default' : 'pointer', opacity: regSaving ? 0.6 : 1 }}>
            {regSaving ? 'Sending…' : 'Save & send message →'}
          </button>
          {regErr && <p style={{ color: '#c0392b', fontSize: '13px', margin: '10px 0 0', textAlign: 'center' }}>{regErr}</p>}
        </div>
      </div>
    )}
    </>
  );
}
