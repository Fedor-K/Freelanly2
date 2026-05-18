'use client';

import { useState, useEffect, Fragment } from 'react';
import { useTracker } from '@/hooks/useTracker';

function SendCountdown() {
  const [text, setText] = useState('');
  useEffect(() => {
    function calc() {
      const now = new Date();
      const min = now.getMinutes();
      const sec = now.getSeconds();
      // Worker runs at :00, :10, :20, :30, :40, :50 — sending phase starts ~2 min after
      const nextCycle = 10 - (min % 10);
      const totalSec = nextCycle * 60 - sec + 120; // +2 min for matching phase
      if (totalSec <= 0) { setText('sending now...'); return; }
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setText(`sending in ${m}:${s.toString().padStart(2, '0')}`);
    }
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{text}</>;
}

type AppRow = {
  id: string;
  jobTitle: string;
  companyName: string;
  status: string;
  subject: string;
  date: string;
  followUp: string | null;
  replyCategory: string | null;
  matchScore: number | null;
};

type AppDetail = {
  description: string;
  coverLetter: string;
  appliedToEmail: string;
  clientName: string | null;
  replyText: string | null;
  replyCategory: string | null;
  repliedAt: string | null;
  sourceUrl: string | null;
} | null;

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'Queued', cls: 'queued' },
  REVIEW: { label: 'Review', cls: 'queued' },
  SENDING: { label: 'Sending', cls: 'sent' },
  SENT: { label: 'Sent', cls: 'sent' },
  DELIVERED: { label: 'Sent', cls: 'sent' },
  OPENED: { label: 'Opened', cls: 'opened' },
  REPLIED: { label: 'Replied', cls: 'replied' },
  INTERVIEW: { label: 'Interview', cls: 'interview' },
  OFFER: { label: 'Offer', cls: 'interview' },
  REJECTED: { label: 'Rejected', cls: 'rejected' },
  FAILED: { label: 'Failed', cls: 'failed' },
};

const DEFAULT_FILTER = ['SENT', 'DELIVERED', 'OPENED', 'REPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'];

const FILTERS = [
  { label: 'All', value: DEFAULT_FILTER },
  { label: 'Sent', value: ['SENT', 'DELIVERED'] },
  { label: 'Opened', value: ['OPENED'] },
  { label: 'Replied', value: ['REPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ApplicationsTable({ rows, sentToday = 0, dailyLimit = 15, isPro = false }: { rows: AppRow[]; sentToday?: number; dailyLimit?: number; isPro?: boolean }) {
  const { track } = useTracker();
  const limitReached = !isPro && sentToday >= dailyLimit;
  const [filter, setFilter] = useState<string[]>(DEFAULT_FILTER);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppDetail>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const filtered = rows.filter(r => filter.includes(r.status));

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      setReplyText('');
      setSendResult(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    setReplyText('');
    setSendResult(null);
    setLoadingDetail(true);
    const row = rows.find(r => r.id === id);
    track('REPLY_EXPANDED', { applicationId: id, status: row?.status, company: row?.companyName });
    try {
      const res = await fetch(`/api/user/auto-apply/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.replyText) {
          track('REPLY_VIEWED', { applicationId: id, company: row?.companyName, replyCategory: data.replyCategory });
        }
        setDetail({
          description: data.description || '',
          coverLetter: data.coverLetter || '',
          appliedToEmail: data.appliedToEmail || '',
          clientName: data.clientName || data.companyName || null,
          replyText: data.replyText || null,
          replyCategory: data.replyCategory || null,
          repliedAt: data.repliedAt || null,
          sourceUrl: data.originalUrl || data.sourceUrl || null,
        });
      }
    } catch { /* ignore */ }
    setLoadingDetail(false);
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
    } catch { /* ignore */ }
    setSuggestLoading(false);
  }

  async function handleSendReply(appId: string) {
    if (!replyText.trim()) return;
    setSendLoading(true);
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
    } catch {
      setSendResult('Failed to send');
    }
    setSendLoading(false);
  }

  return (
    <div>
      <div style={{ padding: '8px 16px 0', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button
            key={f.label}
            className={`filter-tab ${JSON.stringify(filter) === JSON.stringify(f.value) ? 'active' : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label} ({rows.filter(r => f.value.includes(r.status)).length})
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="app-table">
          <thead>
            <tr>
              <th style={{ width: '28%' }}>Job title</th>
              <th style={{ width: '20%' }}>Company</th>
              <th style={{ width: '14%' }}>Date</th>
              <th style={{ width: '14%' }}>Status</th>
              <th style={{ width: '24%' }}>Subject</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--ink-4)', padding: '32px 16px' }}>
                  No applications yet
                </td>
              </tr>
            ) : filtered.map(app => {
              const st = STATUS_MAP[app.status] || { label: app.status, cls: 'sent' };
              const isExpanded = expandedId === app.id;
              return (
                <Fragment key={app.id}>
                  <tr onClick={() => toggleExpand(app.id)} style={{ cursor: 'pointer' }}>
                    <td className="job-title">{app.jobTitle}</td>
                    <td className="company">{app.companyName}</td>
                    <td className="date">{formatDate(app.date)}</td>
                    <td>
                      <span className={`status-chip ${st.cls}`}>{
                        app.status === 'REPLIED' && app.replyCategory === 'INFO_REQUEST' ? 'Asks for info' :
                        app.status === 'REPLIED' && app.replyCategory === 'INTERESTED' ? 'Interested' :
                        app.status === 'REPLIED' ? 'Interested' :
                        app.status === 'INTERVIEW' ? 'Wants interview' :
                        app.status === 'REJECTED' ? 'Not a fit' :
                        st.label
                      }</span>
                      {['PENDING', 'REVIEW', 'SENDING'].includes(app.status) && (
                        <div style={{ fontSize: '10.5px', color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace", marginTop: '2px' }}>
                          {limitReached ? 'tomorrow' : 'sending soon'}
                        </div>
                      )}
                    </td>
                    <td className="subject">{app.subject || ''}</td>
                  </tr>

                  {isExpanded && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0, background: 'var(--bg-2)', borderBottom: '2px solid var(--line)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '20px 16px' }}>
                          {loadingDetail ? (
                            <div style={{ color: 'var(--ink-4)', fontSize: '13px' }}>Loading...</div>
                          ) : detail ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                              {/* Left: project info */}
                              <div>
                                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '8px' }}>Project details</div>
                                <div style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6, maxHeight: '200px', overflow: 'auto' }}>
                                  {detail.description || 'No description available'}
                                </div>
                                <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--ink-3)' }}>
                                  <strong>Recruiter:</strong> {detail.clientName || app.companyName} · {detail.appliedToEmail}
                                </div>
                                {detail.sourceUrl && (
                                  <a href={detail.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', color: 'var(--acid-deep)' }}>View original posting →</a>
                                )}
                              </div>

                              {/* Right: conversation + reply */}
                              <div>
                                <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '8px' }}>Conversation</div>

                                {/* Your application */}
                                <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                                  <div style={{ fontSize: '11px', color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace", marginBottom: '4px' }}>You · {formatDate(app.date)}</div>
                                  <div style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.5, maxHeight: '120px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                                    {detail.coverLetter || (['PENDING', 'REVIEW'].includes(app.status) ? 'Cover letter will be generated before sending' : 'Cover letter sent')}
                                  </div>
                                </div>

                                {/* Follow-up */}
                                {app.followUp === 'sent' && (
                                  <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace" }}>You · Follow-up sent</div>
                                  </div>
                                )}

                                {/* Recruiter reply */}
                                {detail.replyText && (
                                  <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                                    <div style={{ fontSize: '11px', color: '#065F46', fontFamily: "'Geist Mono', monospace", marginBottom: '4px' }}>
                                      {detail.clientName || app.companyName} · {detail.repliedAt ? timeAgo(detail.repliedAt) : 'replied'}
                                      {detail.replyCategory && <span style={{ marginLeft: '8px', background: '#D1FAE5', padding: '1px 6px', borderRadius: '4px', fontSize: '10px' }}>{detail.replyCategory.toLowerCase()}</span>}
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#065F46', lineHeight: 1.5, maxHeight: '150px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                                      {detail.replyText}
                                    </div>
                                  </div>
                                )}

                                {/* Reply box — show when there's a recruiter reply */}
                                {detail.replyText && (
                                  <div style={{ marginTop: '8px' }}>
                                    <textarea
                                      value={replyText}
                                      onChange={e => setReplyText(e.target.value)}
                                      placeholder="Write a reply..."
                                      rows={3}
                                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--line-2)', borderRadius: '8px', fontSize: '13px', resize: 'vertical', background: 'var(--bg)', lineHeight: 1.5 }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
                                      <button className="btn btn-ghost btn-sm" onClick={() => handleSuggest(app.id)} disabled={suggestLoading}>
                                        {suggestLoading ? 'Generating...' : '✦ AI suggest'}
                                      </button>
                                      <button className="btn btn-primary btn-sm" onClick={() => handleSendReply(app.id)} disabled={sendLoading || !replyText.trim()}>
                                        {sendLoading ? 'Sending...' : 'Send reply'}
                                      </button>
                                      {sendResult && <span style={{ fontSize: '12px', color: sendResult === 'Sent!' ? 'var(--good)' : '#DC2626' }}>{sendResult}</span>}
                                    </div>
                                  </div>
                                )}

                                {/* Follow-up timer for non-replied */}
                                {!detail.replyText && app.followUp && app.followUp !== 'sent' && (
                                  <div style={{ fontSize: '12px', color: app.followUp === 'overdue' ? '#DC2626' : 'var(--ink-4)', marginTop: '4px', fontFamily: "'Geist Mono', monospace" }}>
                                    {app.followUp === 'overdue' ? 'Follow-up overdue — will send on next cycle' : `Follow-up ${app.followUp}`}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div style={{ color: 'var(--ink-4)', fontSize: '13px' }}>Failed to load details</div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Daily limit banner */}
      {limitReached && (
        <div style={{
          margin: '0 16px 16px',
          padding: '16px 20px',
          background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', color: '#92400E' }}>
              Daily limit reached ({sentToday}/{dailyLimit})
            </div>
            <div style={{ fontSize: '13px', color: '#A16207', marginTop: '2px' }}>
              More matches found — upgrade to send unlimited applications today
            </div>
          </div>
          <a href="/pricing" style={{
            padding: '8px 16px',
            background: '#000',
            color: '#fff',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 500,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
            Upgrade to Pro
          </a>
        </div>
      )}

      {/* Progress bar for daily limit */}
      {!isPro && !limitReached && sentToday > 0 && (
        <div style={{ margin: '0 16px 16px', padding: '12px 16px', background: 'var(--bg-2)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: "'Geist Mono', monospace", color: 'var(--ink-3)', marginBottom: '6px' }}>
            <span>{sentToday}/{dailyLimit} sent today</span>
            <span>{dailyLimit - sentToday} remaining</span>
          </div>
          <div style={{ height: '4px', background: 'var(--line)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(sentToday / dailyLimit) * 100}%`, background: sentToday / dailyLimit > 0.8 ? '#F59E0B' : 'var(--acid)', borderRadius: '2px', transition: 'width 300ms' }}></div>
          </div>
        </div>
      )}
    </div>
  );
}
