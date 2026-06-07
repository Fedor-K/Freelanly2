'use client';

import { RIcon } from '../icons';
import { useCabinet } from '../RecruiterCabinet';
import { avColor, initials, timeAgo } from '../lib';

export function OverviewView() {
  const { candidates, groups, conversations, colorIdx, revealsUsed, isPro, openDetail, setView, openPaywall, recruiter } = useCabinet();

  const strong = candidates.filter((c) => c.strength === 'Strong');
  const newOvernight = candidates.filter((c) => (Date.now() - new Date(c.createdAt).getTime()) / 3600000 <= 24).length;
  const firstName = (recruiter.name || '').split(' ')[0] || 'there';

  const topMatches = strong.slice(0, 4);
  // Recent activity: newest applies + replies, interleaved by time.
  const activity = [...candidates]
    .map((c) => ({ c, at: c.repliedAt || c.createdAt, replied: !!c.repliedAt }))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 6);

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Hi {firstName} — {newOvernight} new candidate{newOvernight === 1 ? '' : 's'} recently.</h1>
          <p>{strong.length} <b>Strong</b> match{strong.length === 1 ? '' : 'es'} across your {groups.length} role{groups.length === 1 ? '' : 's'}, sorted and ready to review.</p>
        </div>
        <div className="page-actions">
          <a href="#" className="btn btn-acid" onClick={(e) => { e.preventDefault(); setView('candidates'); }}><RIcon name="users" size={14} /> Review candidates</a>
        </div>
      </div>

      <div className="kpi-grid mb-4">
        <div className="kpi"><div className="kpi-label">Total candidates</div><div className="kpi-value tabular">{candidates.length}</div><div className="kpi-delta up">{newOvernight} in last 24h</div></div>
        <div className="kpi"><div className="kpi-label">Active conversations</div><div className="kpi-value tabular">{conversations.length}</div><div className="kpi-delta" style={{ color: 'var(--ink-3)' }}>candidates who replied</div></div>
        <div className="kpi"><div className="kpi-label">Contacts revealed</div><div className="kpi-value tabular">{revealsUsed}{!isPro && <span className="unit"> / 2 free</span>}</div><div className="kpi-delta" style={{ color: 'var(--ink-3)' }}>{isPro ? 'Pro · unlimited' : 'Free plan'}</div></div>
        <div className="kpi"><div className="kpi-label">Open roles</div><div className="kpi-value tabular">{groups.length}</div><div className="kpi-delta up">All collecting applicants</div></div>
      </div>

      <div className="ov-grid">
        {/* LEFT */}
        <div className="col gap-4">
          <div className="card">
            <div className="card-head">
              <div className="row gap-3"><h3>Top matches to review</h3><span className="chip chip-acid-soft"><span className="chip-dot live" />sorted by match</span></div>
              <a href="#" className="muted f-mono" style={{ fontSize: '11px', letterSpacing: '0.04em', textTransform: 'uppercase' }} onClick={(e) => { e.preventDefault(); setView('candidates'); }}>All candidates →</a>
            </div>
            {topMatches.length === 0 ? (
              <div className="card-pad"><p className="meta" style={{ fontSize: '13px' }}>No Strong matches yet — check the full candidate list.</p></div>
            ) : topMatches.map((c) => {
              const i = colorIdx[c.appId] ?? 0;
              return (
                <div key={c.appId} className="top-cand" onClick={() => openDetail(c.appId)}>
                  <div className="cand-av av-sm" style={{ width: '32px', height: '32px', fontSize: '12px', background: avColor(i) }}>{initials(c.name)}</div>
                  <div>
                    <div className="row gap-2"><span style={{ fontSize: '13.5px', fontWeight: 500, whiteSpace: 'nowrap' }}>{c.name}</span>{c.score != null && <span className="match-badge match-strong" style={{ height: '18px', padding: '0 8px' }}><span className="dot" />{c.score}%</span>}</div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{c.profile.current_title || c.jobTitle}{c.profile.location && ` · ${c.profile.location}`}</div>
                  </div>
                  <span className="btn btn-ghost btn-sm">Review</span>
                </div>
              );
            })}
          </div>

          <div className="card">
            <div className="card-head"><h3>Recent activity</h3><span className="meta mono">latest</span></div>
            <div>
              {activity.map(({ c, at, replied }, idx) => (
                <div key={idx} className="feed-row">
                  <div className="feed-dot" style={{ background: replied ? 'var(--acid)' : '#6EE7FF' }}><RIcon name={replied ? 'chat' : 'users'} size={15} /></div>
                  <div className="ft">
                    <b>{c.name}</b> {replied ? 'replied to your outreach' : <>applied to <b>{c.jobTitle}</b></>}
                  </div>
                  <div className="when">{timeAgo(at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="col gap-4">
          {!isPro && (
            <div className="contact-lock">
              <div className="cl-head">
                <div className="cl-lockico"><RIcon name="bolt" size={17} /></div>
                <div><div className="cl-title">Unlock the full pool</div><div className="cl-sub">You&rsquo;re on the Free plan</div></div>
              </div>
              <div className="cl-body">
                <p className="muted" style={{ fontSize: '13px', lineHeight: 1.55, margin: '0 0 14px' }}>Go Pro for unlimited contact reveals, full-pool search, and job posting.</p>
                <button className="btn btn-acid btn-lg" style={{ width: '100%' }} onClick={openPaywall}>Upgrade to Pro — $49/mo</button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-head"><h3>Your roles</h3><span className="meta mono">{groups.length} open</span></div>
            {groups.map((g) => {
              const strongN = g.items.filter((c) => c.strength === 'Strong').length;
              return (
                <div key={g.key} className="top-cand" onClick={() => setView('candidates')}>
                  <div className="feed-dot" style={{ background: 'var(--bg-2)', color: 'var(--ink-3)' }}><RIcon name="briefcase" size={15} /></div>
                  <div><div style={{ fontSize: '13.5px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.jobTitle}</div><div className="mono" style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{g.items.length} applicants · {strongN} strong</div></div>
                  <span className="chip chip-acid-soft" style={{ height: '20px' }}>active</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
