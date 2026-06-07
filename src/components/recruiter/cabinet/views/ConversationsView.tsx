'use client';

import { useEffect, useState } from 'react';
import { RIcon } from '../icons';
import { useCabinet } from '../RecruiterCabinet';
import { ChatThread, Compose, MatchBadge, intentPill } from '../parts';
import { avColor, initials, timeAgo } from '../lib';

export function ConversationsView() {
  const cab = useCabinet();
  const { conversations, colorIdx, loadThread, openDetail, isRevealed, revealedEmail, revealing, doReveal, openPaywall } = cab;
  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.appId ?? null);
  const [filter, setFilter] = useState<'all' | 'interested' | 'interview'>('all');

  useEffect(() => { if (activeId) loadThread(activeId); }, [activeId, loadThread]);

  if (conversations.length === 0) {
    return (
      <>
        <div className="page-header"><div className="page-title"><h1>Conversations</h1><p>Threads with candidates who replied to you.</p></div></div>
        <div className="card"><div className="empty-state">
          <div className="empty-ico"><RIcon name="inbox" size={26} /></div>
          <h3>No replies yet</h3>
          <p>When a candidate replies to your outreach, the conversation opens here. Reveal a contact or send the first message from a candidate&rsquo;s profile to get things going.</p>
        </div></div>
      </>
    );
  }

  const shown = conversations.filter((c) => {
    if (filter === 'all') return true;
    const s = (c.status || '').toUpperCase();
    if (filter === 'interview') return s === 'INTERVIEW' || s === 'OFFER';
    return s === 'REPLIED' || !!c.repliedAt;
  });
  const active = conversations.find((c) => c.appId === activeId) || shown[0] || conversations[0];

  return (
    <>
      <div className="page-header" style={{ marginBottom: '18px' }}>
        <div className="page-title">
          <h1>Conversations</h1>
          <p>{conversations.length} active thread{conversations.length === 1 ? '' : 's'} with candidates who applied to your roles.</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
            <button className={filter === 'interested' ? 'active' : ''} onClick={() => setFilter('interested')}>Interested</button>
            <button className={filter === 'interview' ? 'active' : ''} onClick={() => setFilter('interview')}>Interview</button>
          </div>
        </div>
      </div>

      <div className="conv-layout">
        {/* list */}
        <div className="card conv-list-pane">
          <div className="card-head"><h3>Inbox</h3><span className="meta mono">{shown.length}</span></div>
          <div>
            {shown.map((c) => {
              const i = colorIdx[c.appId] ?? 0;
              return (
                <div key={c.appId} className={`conv-row${c.appId === active?.appId ? ' active' : ''}`} onClick={() => setActiveId(c.appId)}>
                  <div className="cand-av av-sm" style={{ width: '40px', height: '40px', fontSize: '13px', background: avColor(i) }}>{initials(c.name)}</div>
                  <div style={{ minWidth: 0 }}>
                    <div className="row between"><span className="nm">{c.name}</span></div>
                    <div className="rl">{c.jobTitle}</div>
                    {c.replyPreview && <div className="prev" style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{c.replyPreview}</div>}
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end', gap: '8px' }}>
                    <span className="when">{c.repliedAt ? timeAgo(c.repliedAt) : timeAgo(c.createdAt)}</span>
                    {intentPill(c)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* thread */}
        <div className="card conv-thread-pane">
          {active && (() => {
            const i = colorIdx[active.appId] ?? 0;
            const revealed = isRevealed(active.appId);
            const email = revealedEmail(active.appId);
            return (
              <>
                <div className="thread-head">
                  <div className="cand-av av-sm" style={{ width: '40px', height: '40px', fontSize: '13px', background: avColor(i) }}>{initials(active.name)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row gap-2"><span style={{ fontSize: '14.5px', fontWeight: 500 }}>{active.name}</span><MatchBadge strength={active.strength} label={active.score != null ? `${active.score}%` : undefined} /></div>
                    <div className="mono" style={{ fontSize: '11px', color: 'var(--ink-4)' }}>{active.profile.current_title || active.jobTitle}{active.profile.timezone && ` · ${active.profile.timezone}`}</div>
                  </div>
                  <a href="#" className="btn btn-ghost btn-sm" onClick={(e) => { e.preventDefault(); openDetail(active.appId); }}>View profile</a>
                </div>
                <div className="thread-body">
                  <div style={{ marginBottom: '18px' }}>
                    {revealed && email ? (
                      <a className="contact-line" href={`mailto:${email}`} style={{ display: 'inline-flex' }}><RIcon name="mail" size={15} /> <span className="mono">{email}</span></a>
                    ) : revealed ? (
                      <div className="meta" style={{ fontSize: '12px' }}>Contact revealed — open the profile to email directly.</div>
                    ) : (
                      <div className="row between" style={{ background: 'var(--bg-1)', border: '1px solid rgba(199,249,74,0.4)', borderRadius: 'var(--r-md)', padding: '10px 14px' }}>
                        <div className="row gap-2"><span style={{ color: 'var(--ink)' }}><RIcon name="lock" size={15} /></span><span style={{ fontSize: '13px' }}>Contact locked — reveal to email directly</span></div>
                        <button className="lock-inline" onClick={() => doReveal(active.appId)} disabled={revealing === active.appId}><RIcon name="unlock" size={13} /> {revealing === active.appId ? 'Revealing…' : 'Reveal'}</button>
                      </div>
                    )}
                  </div>
                  <ChatThread c={active} />
                </div>
                <Compose c={active} withSchedule />
              </>
            );
          })()}
        </div>
      </div>
    </>
  );
}
