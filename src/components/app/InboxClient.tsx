'use client';

import { useState } from 'react';

type Reply = {
  id: string;
  companyName: string;
  jobTitle: string;
  coverLetter: string;
  subject: string;
  replyText: string | null;
  replyCategory: string | null;
  replySignal: string | null;
  repliedAt: string | null;
  sentAt: string | null;
  appliedToEmail: string;
  userName: string;
  userEmail: string;
};

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

function cleanReplyHtml(text: string): string {
  let cleaned = text;
  // Remove quoted original message (On ... wrote:)
  cleaned = cleaned.replace(/On\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun|[\d]{1,2})[\s\S]*?wrote:[\s\S]*/i, '').trim();
  // Remove email signatures after -- or __ or common sign-offs followed by name+company block
  cleaned = cleaned.replace(/\n--\s*\n[\s\S]*/m, '').trim();
  cleaned = cleaned.replace(/\n__+\s*\n[\s\S]*/m, '').trim();
  // Remove GDPR/disclaimer blocks
  cleaned = cleaned.replace(/This email may contain[\s\S]*/i, '').trim();
  cleaned = cleaned.replace(/CONFIDENTIAL[\s\S]*/i, '').trim();
  // Remove HTML entities leftovers
  cleaned = cleaned.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // Remove URLs in angle brackets
  cleaned = cleaned.replace(/<https?:\/\/[^>]+>/g, '');
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  // Convert newlines to <br/>
  return cleaned.replace(/\n/g, '<br/>');
}

function timeAgo(date: string | null): string {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  const d = Math.floor(s / 86400);
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  return 'Last week';
}

function chipClass(category: string | null): string {
  if (!category) return 'chip';
  const c = category.toLowerCase();
  if (['interested', 'interview'].includes(c)) return 'chip chip-acid-soft';
  if (['booked', 'offer', 'contract'].includes(c)) return 'chip chip-good';
  if (['rejected', 'not_interested', 'passed'].includes(c)) return 'chip chip-bad';
  return 'chip';
}

export function InboxClient({ replies }: { replies: Reply[] }) {
  const [activeId, setActiveId] = useState(replies[0]?.id || null);
  const [filter, setFilter] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);

  async function handleSend(appId: string) {
    if (!replyText.trim() || sending) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/user/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId, action: 'send', message: replyText }),
      });
      if (res.ok) {
        setSendResult('Sent!');
        setReplyText('');
      } else {
        const data = await res.json();
        setSendResult(`Failed: ${data.error || 'unknown'}`);
      }
    } catch { setSendResult('Failed to send'); }
    setSending(false);
  }

  async function handleSuggest(appId: string) {
    setSuggestLoading(true);
    try {
      const res = await fetch('/api/user/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId, action: 'suggest' }),
      });
      if (res.ok) {
        const data = await res.json();
        setReplyText(data.full || data.suggested || '');
      }
    } catch {}
    setSuggestLoading(false);
  }

  const filtered = filter === 'all' ? replies
    : filter === 'interested' ? replies.filter(r => r.replyCategory === 'INTERESTED' || r.replyCategory === 'INTERVIEW')
    : filter === 'booked' ? replies.filter(r => r.replyCategory === 'OFFER' || r.replyCategory?.toLowerCase().includes('book'))
    : replies;

  const unreadCount = replies.filter(r => r.replyCategory === 'INTERESTED' || r.replyCategory === 'INTERVIEW').length;
  const active = replies.find(r => r.id === activeId) || null;

  return (
    <div className="inbox-grid">

      {/* THREAD LIST */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {/* Filter tabs */}
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'interested', label: `Interested (${unreadCount})` },
            { key: 'booked', label: 'Booked' },
          ].map(f => (
            <button
              key={f.key}
              className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f.key)}
            >{f.label}</button>
          ))}
        </div>

        <div className="thread-list">
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px' }}>
              No replies match this filter.
            </div>
          ) : filtered.map((r, i) => (
            <div
              key={r.id}
              className={`thread-item${r.id === activeId ? ' active' : ''}`}
              onClick={() => setActiveId(r.id)}
            >
              <div className="avatar av-sm" style={{ background: COLORS[i % COLORS.length] }}>{r.companyName.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="row between" style={{ marginBottom: '2px' }}>
                  <span className="name" style={{ fontSize: '13.5px' }}>{r.companyName}</span>
                  <span className="meta" style={{ fontSize: '10.5px' }}>{timeAgo(r.repliedAt)}</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginBottom: '4px' }}>{r.jobTitle}</div>
                <div style={{ fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: 1.4, maxHeight: '36px', overflow: 'hidden' }}>
                  {r.replyText?.slice(0, 120) || 'Reply received'}
                </div>
                {r.replyCategory && (
                  <div className="row gap-1 mt-2">
                    <span className={chipClass(r.replyCategory)} style={{ height: '18px', padding: '0 7px', fontSize: '9.5px' }}>{r.replyCategory.toLowerCase()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ACTIVE THREAD */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
        {active ? (
          <>
            <div className="card-head" style={{ padding: '14px 24px' }}>
              <div className="row gap-3" style={{ alignItems: 'center' }}>
                <div className="avatar" style={{ background: COLORS[replies.indexOf(active) % COLORS.length], width: '36px', height: '36px', fontSize: '12px' }}>{active.companyName.slice(0, 2).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500 }}>{active.companyName}</div>
                  <div className="meta" style={{ marginTop: '2px' }}>{active.jobTitle} · {active.appliedToEmail}</div>
                </div>
                {active.replyCategory && (
                  <span className={chipClass(active.replyCategory)}>
                    <span className="chip-dot live"></span>
                    {active.replyCategory.toLowerCase()}
                  </span>
                )}
              </div>
              <div className="row gap-2">
                <a
                  href={`mailto:${active.appliedToEmail}?subject=Re: ${active.subject || active.jobTitle}`}
                  className="btn btn-ghost btn-sm"
                >Book call</a>
                <button className="btn btn-ghost btn-sm">Move to Pipeline</button>
              </div>
            </div>

            <div className="message-list" style={{ flex: 1 }}>
              {active.coverLetter && (
                <div className="msg you">
                  <div className="msg-head">
                    <span className="msg-from">{active.userName} · sent via Freelanly</span>
                    <span className="msg-time">{active.sentAt ? new Date(active.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                  </div>
                  <div className="msg-body" dangerouslySetInnerHTML={{ __html: active.coverLetter.replace(/\n/g, '<br/>') }} />
                </div>
              )}

              <div className="msg them">
                <div className="msg-head">
                  <span className="msg-from">{active.companyName}</span>
                  <span className="msg-time">{active.repliedAt ? new Date(active.repliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                </div>
                <div className="msg-body" dangerouslySetInnerHTML={{ __html: cleanReplyHtml(active.replyText || 'Reply received') }} />
              </div>

              {active.replySignal && (
                <div style={{ padding: '12px 16px', background: 'var(--acid-tint)', borderRadius: '10px', fontSize: '13px', color: 'var(--acid-deep)', marginBottom: '14px' }}>
                  <strong>AI Signal:</strong> {active.replySignal}
                </div>
              )}
            </div>

            <div className="reply-cta" style={{ flexDirection: 'column', gap: '10px' }}>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write your reply..."
                style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '13.5px', lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleSuggest(active.id)}
                  disabled={suggestLoading}
                >{suggestLoading ? 'Thinking...' : 'AI Suggest'}</button>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {sendResult && <span style={{ fontSize: '12px', color: sendResult === 'Sent!' ? 'var(--good)' : 'var(--bad)' }}>{sendResult}</span>}
                  <button
                    className="btn btn-acid btn-sm"
                    onClick={() => handleSend(active.id)}
                    disabled={sending || !replyText.trim()}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                    {sending ? 'Sending...' : 'Send reply'}
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '14px' }}>
            Select a thread to view the conversation.
          </div>
        )}
      </div>
    </div>
  );
}
