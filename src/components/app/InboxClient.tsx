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
  replyUnlocked?: boolean;
  // Paywall now gates SENDING, not reading. Reading the recruiter's message is always free;
  // sendLocked=true means the user must pay $5 (or already spent their free credit) to reply.
  sendLocked?: boolean;
};

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

function cleanReplyText(text: string): string {
  let cleaned = text;
  // Remove MIME boundaries (--_000_XXX...)
  cleaned = cleaned.replace(/--_\w+[\w._-]*_?\s*/g, '').trim();
  cleaned = cleaned.replace(/--\w{20,}\s*/g, '').trim();
  // Remove quoted original message (On ... wrote:)
  cleaned = cleaned.replace(/On\s+(Mon|Tue|Wed|Thu|Fri|Sat|Sun|[\d]{1,2})[\s\S]*?wrote:[\s\S]*/i, '').trim();
  // Remove email signatures after -- or __
  cleaned = cleaned.replace(/\n--\s*\n[\s\S]*/m, '').trim();
  cleaned = cleaned.replace(/\n__+\s*\n[\s\S]*/m, '').trim();
  // Remove GDPR/disclaimer blocks
  cleaned = cleaned.replace(/This email may contain[\s\S]*/i, '').trim();
  cleaned = cleaned.replace(/CONFIDENTIAL[\s\S]*/i, '').trim();
  // Remove HTML entities leftovers
  cleaned = cleaned.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  // Remove URLs in angle brackets
  cleaned = cleaned.replace(/<https?:\/\/[^>]+>/g, '');
  // Remove Content-Type headers
  cleaned = cleaned.replace(/Content-Type:[\s\S]*?\n\n/gi, '').trim();
  // Remove CID image references and mailto links
  cleaned = cleaned.replace(/\[cid:[^\]]*\](\[X\])?/g, '').trim();
  cleaned = cleaned.replace(/<mailto:[^>]+>/g, '').trim();
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
  return cleaned;
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

const RATINGS = [
  { emoji: '😐', label: 'Not a skill match', value: 'wrong_skills' },
  { emoji: '🌍', label: 'Wrong location', value: 'wrong_location' },
  { emoji: '💬', label: 'Other', value: 'other' },
];

export function InboxClient({ replies, resumeAttachable = false, resumeFileName = null, telegramConnected = false, telegramLink = '' }: { replies: Reply[]; resumeAttachable?: boolean; resumeFileName?: string | null; telegramConnected?: boolean; telegramLink?: string }) {
  const [activeId, setActiveId] = useState(replies[0]?.id || null);
  const [filter, setFilter] = useState<string>('all');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [ratings, setRatings] = useState<Record<string, string>>({});
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  // Recruiters ask for the CV constantly — default the attach toggle ON when a résumé exists.
  const [attachResume, setAttachResume] = useState(resumeAttachable);
  const [unlocking, setUnlocking] = useState(false);

  async function handleUnlock(appId: string) {
    if (unlocking) return;
    setUnlocking(true);
    try {
      const res = await fetch('/api/stripe/unlock-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId }),
      });
      const data = await res.json();
      if (data.url) { window.location.href = data.url; return; }      // → Stripe Checkout
      if (data.alreadyUnlocked) { window.location.reload(); return; }
    } catch {}
    setUnlocking(false);
  }

  async function handleSend(appId: string) {
    if (!replyText.trim() || sending) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch('/api/user/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId, action: 'send', message: replyText, attachResume: attachResume && resumeAttachable }),
      });
      if (res.ok) {
        setSendResult('Sent!');
        setReplyText('');
      } else if (res.status === 402) {
        // Paywall: sending this reply is locked → open the $5 checkout.
        setSending(false);
        handleUnlock(appId);
        return;
      } else {
        const data = await res.json();
        setSendResult(`Failed: ${data.error || 'unknown'}`);
      }
    } catch { setSendResult('Failed to send'); }
    setSending(false);
  }

  async function handleRate(appId: string, rating: string) {
    setRatings(prev => ({ ...prev, [appId]: rating }));
    fetch('/api/user/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationId: appId, action: 'rate', message: rating }),
    }).catch(() => {});
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
    <>
    {replies.length > 0 && !telegramConnected && telegramLink && (
      <a href={telegramLink} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: '0 0 14px', padding: '12px 18px', borderRadius: '12px', background: 'linear-gradient(135deg,#E8F5E9,#F1F8E9)', border: '1px solid #C8E6C9', textDecoration: 'none', color: '#1B5E20' }}>
        <span style={{ fontSize: '13px' }}><strong>🔔 Don&apos;t miss the next interview.</strong> Connect Telegram — we&apos;ll ping you the instant a recruiter wants to talk, so a reply doesn&apos;t sit unseen in email.</span>
        <span style={{ padding: '7px 14px', background: '#0088cc', color: '#fff', borderRadius: '8px', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>Connect →</span>
      </a>
    )}
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
                  <span className="meta" style={{ fontSize: '10.5px' }} suppressHydrationWarning>{timeAgo(r.repliedAt)}</span>
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

            {/* Messages — messenger style */}
            <div style={{ flex: 1, overflow: 'auto', padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

              {/* Your message — right side */}
              {active.coverLetter && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ maxWidth: '75%' }}>
                    <div style={{ background: 'var(--ink)', color: '#FAFAF7', borderRadius: '16px 16px 4px 16px', padding: '12px 16px' }}>
                      <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{active.coverLetter}</div>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--ink-4)', marginTop: '4px', textAlign: 'right', fontFamily: "'Geist Mono', monospace" }}>
                      You · {active.sentAt ? new Date(active.sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ''}
                    </div>
                  </div>
                </div>
              )}

              {/* Recruiter reply — left side. Reading is ALWAYS free (paywall moved to sending). */}
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ maxWidth: '75%' }}>
                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '16px 16px 16px 4px', padding: '12px 16px' }}>
                    <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#065F46', whiteSpace: 'pre-wrap' }}>
                      {cleanReplyText(active.replyText || 'Reply received')}
                    </div>
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--ink-4)', marginTop: '4px', fontFamily: "'Geist Mono', monospace", display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {active.companyName} · {active.repliedAt ? new Date(active.repliedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : ''}
                    {active.replyCategory && <span style={{ background: '#D1FAE5', padding: '1px 6px', borderRadius: '4px', fontSize: '9px', color: '#065F46' }}>{active.replyCategory.toLowerCase()}</span>}
                  </div>
                </div>
              </div>

              {active.replySignal && (
                <div style={{ alignSelf: 'center', padding: '8px 14px', background: 'var(--acid-tint)', borderRadius: '20px', fontSize: '12px', color: 'var(--acid-deep)' }}>
                  ✦ {active.replySignal}
                </div>
              )}

              {/* Rating */}
              <div style={{ alignSelf: 'center', marginTop: '4px' }}>
                {ratings[active.id] ? (
                  <div style={{ fontSize: '12px', color: 'var(--ink-4)' }}>
                    Thanks for your feedback {RATINGS.find(r => r.value === ratings[active.id])?.emoji}
                  </div>
                ) : ratings[active.id + '_showOther'] ? (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      type="text"
                      placeholder="What's wrong?"
                      maxLength={100}
                      style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '11px', width: '180px' }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { const val = (e.target as HTMLInputElement).value.trim(); if (val) handleRate(active.id, 'other:' + val); } }}
                    />
                    <button
                      style={{ padding: '4px 8px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '11px', cursor: 'pointer' }}
                      onClick={(e) => { const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement; if (input?.value.trim()) handleRate(active.id, 'other:' + input.value.trim()); }}
                    >Send</button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginBottom: '6px', textAlign: 'center' }}>Rate this reply:</div>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {RATINGS.map(r => (
                        <button
                          key={r.value}
                          onClick={() => {
                            if (r.value === 'other') {
                              setRatings(prev => ({ ...prev, [active.id + '_showOther']: 'true' }));
                            } else {
                              handleRate(active.id, r.value);
                            }
                          }}
                          style={{ padding: '4px 8px', borderRadius: '14px', border: '1px solid var(--line)', background: 'var(--bg)', fontSize: '11px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          {r.emoji} {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reply input — bottom bar. Reading is free; SENDING is what's gated ($5/thread,
                first reply free). Locked → show the pay button instead of the composer. */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--line)', background: 'var(--bg-2)' }}>
              {active.sendLocked ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <button className="btn btn-primary btn-sm" onClick={() => handleUnlock(active.id)} disabled={unlocking}>
                  {unlocking ? 'Opening checkout…' : '🔓 Unlock to reply — $5'}
                </button>
                <div style={{ fontSize: '11px', color: 'var(--ink-4)', marginTop: '6px' }}>Reading is free — pay only to send your reply.</div>
              </div>
              ) : (
              <>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '13px', resize: 'vertical', background: 'var(--bg)', lineHeight: 1.5 }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleSuggest(active.id)} disabled={suggestLoading}>
                  {suggestLoading ? 'Generating...' : '✦ AI suggest'}
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => handleSend(active.id)} disabled={sending || !replyText.trim()}>
                  {sending ? 'Sending...' : 'Send reply'}
                </button>
                {resumeAttachable ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--ink-3)', cursor: 'pointer', marginLeft: 'auto' }}>
                    <input type="checkbox" checked={attachResume} onChange={e => setAttachResume(e.target.checked)} />
                    📎 Attach résumé{resumeFileName ? ` · ${resumeFileName}` : ''}
                  </label>
                ) : (
                  <a href="/dashboard/settings#profile" style={{ fontSize: '12px', color: 'var(--ink-4)', marginLeft: 'auto', textDecoration: 'underline' }}>Upload résumé to attach</a>
                )}
                {sendResult && <span style={{ fontSize: '12px', color: sendResult === 'Sent!' ? 'var(--good)' : '#DC2626' }}>{sendResult}</span>}
              </div>
              </>
              )}
            </div>
          </>
        ) : (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '14px' }}>
            Select a thread to view the conversation.
          </div>
        )}
      </div>
    </div>
    </>
  );
}
