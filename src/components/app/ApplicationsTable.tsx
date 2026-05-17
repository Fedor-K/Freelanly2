'use client';

import { useState } from 'react';

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
  followUpText: string | null;
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

const FILTERS = [
  { label: 'All', value: null },
  { label: 'Sent', value: ['SENT', 'DELIVERED'] },
  { label: 'Opened', value: ['OPENED'] },
  { label: 'Replied', value: ['REPLIED', 'INTERVIEW', 'OFFER', 'REJECTED'] },
  { label: 'Queued', value: ['PENDING', 'REVIEW', 'SENDING'] },
  { label: 'Failed', value: ['FAILED'] },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function ApplicationsTable({ rows }: { rows: AppRow[] }) {
  const [filter, setFilter] = useState<string[] | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AppDetail>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);

  const filtered = filter ? rows.filter(r => filter.includes(r.status)) : rows;

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
    try {
      const res = await fetch(`/api/user/auto-apply/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDetail({
          description: data.description || '',
          coverLetter: data.coverLetter || '',
          appliedToEmail: data.appliedToEmail || '',
          clientName: data.clientName || data.companyName || null,
          replyText: data.replyText || null,
          replyCategory: data.replyCategory || null,
          repliedAt: data.repliedAt || null,
          followUpText: data.followUpText || null,
          sourceUrl: data.originalUrl || data.sourceUrl || null,
        });
      }
    } catch { /* ignore */ }
    setLoadingDetail(false);
  }

  async function handleSuggest(appId: string) {
    setSuggestLoading(true);
    try {
      const res = await fetch(`/api/user/inbox`, {
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
      const res = await fetch(`/api/user/inbox`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId, action: 'send', message: replyText }),
      });
      if (res.ok) {
        setSendResult('Sent!');
        setReplyText('');
      } else {
        const data = await res.json();
        setSendResult(`Failed: ${data.error || 'unknown error'}`);
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
            {f.label}
            {f.value ? ` (${rows.filter(r => f.value!.includes(r.status)).length})` : ` (${rows.length})`}
          </button>
        ))}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="app-table">
          <thead>
            <tr>
              <th>Job title</th>
              <th>Company</th>
              <th>Date</th>
              <th>Status</th>
              <th>Subject</th>
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
                <tr key={app.id} onClick={() => toggleExpand(app.id)} style={{ cursor: 'pointer' }}>
                  <td colSpan={5} style={{ padding: 0 }}>
                    {/* Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 120px 130px 1fr', gap: '0', alignItems: 'center' }}>
                      <div style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--ink)' }}>{app.jobTitle}</div>
                      <div style={{ padding: '14px 8px', color: 'var(--ink-2)' }}>{app.companyName}</div>
                      <div style={{ padding: '14px 8px', fontFamily: "'Geist Mono', monospace", fontSize: '12px', color: 'var(--ink-3)' }}>{formatDate(app.date)}</div>
                      <div style={{ padding: '14px 8px' }}>
                        <span className={`status-chip ${st.cls}`}>{st.label}</span>
                        {app.followUp && app.followUp !== 'sent' && (
                          <div className="followup">Follow-up {app.followUp}</div>
                        )}
                        {app.followUp === 'sent' && (
                          <div className="followup">Follow-up sent</div>
                        )}
                      </div>
                      <div style={{ padding: '14px 16px 14px 8px', fontSize: '12.5px', color: 'var(--ink-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.subject || ''}</div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid var(--line)', padding: '20px', background: 'var(--bg-2)' }} onClick={e => e.stopPropagation()}>
                        {loadingDetail ? (
                          <div style={{ color: 'var(--ink-4)', fontSize: '13px' }}>Loading...</div>
                        ) : detail ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                            {/* Left: project info */}
                            <div>
                              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '8px' }}>Project details</div>
                              <div style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.6, maxHeight: '200px', overflow: 'auto' }}>
                                {detail.description ? detail.description.slice(0, 600) + (detail.description.length > 600 ? '...' : '') : 'No description available'}
                              </div>
                              <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--ink-3)' }}>
                                <strong>Recruiter:</strong> {detail.clientName || app.companyName} · {detail.appliedToEmail}
                              </div>
                              {detail.sourceUrl && (
                                <a href={detail.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', fontSize: '12px', color: 'var(--acid-deep)' }}>View original posting →</a>
                              )}
                            </div>

                            {/* Right: conversation thread + reply */}
                            <div>
                              <div style={{ fontFamily: "'Geist Mono', monospace", fontSize: '10.5px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: '8px' }}>Conversation</div>

                              {/* Your application */}
                              <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                                <div style={{ fontSize: '11px', color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace", marginBottom: '4px' }}>You · {formatDate(app.date)}</div>
                                <div style={{ fontSize: '13px', color: 'var(--ink-2)', lineHeight: 1.5, maxHeight: '120px', overflow: 'auto', whiteSpace: 'pre-wrap' }}>
                                  {detail.coverLetter ? detail.coverLetter.slice(0, 400) + (detail.coverLetter.length > 400 ? '...' : '') : 'Cover letter sent'}
                                </div>
                              </div>

                              {/* Follow-up */}
                              {app.followUp === 'sent' && (
                                <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: '10px', padding: '12px', marginBottom: '8px' }}>
                                  <div style={{ fontSize: '11px', color: 'var(--ink-4)', fontFamily: "'Geist Mono', monospace", marginBottom: '4px' }}>You · Follow-up</div>
                                  <div style={{ fontSize: '13px', color: 'var(--ink-2)' }}>Follow-up email sent</div>
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
                                    {detail.replyText.slice(0, 500)}{detail.replyText.length > 500 ? '...' : ''}
                                  </div>
                                </div>
                              )}

                              {/* Reply box */}
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
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => handleSuggest(app.id)}
                                      disabled={suggestLoading}
                                    >{suggestLoading ? 'Generating...' : '✦ AI suggest'}</button>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => handleSendReply(app.id)}
                                      disabled={sendLoading || !replyText.trim()}
                                    >{sendLoading ? 'Sending...' : 'Send reply'}</button>
                                    {sendResult && <span style={{ fontSize: '12px', color: sendResult === 'Sent!' ? 'var(--good)' : '#DC2626' }}>{sendResult}</span>}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--ink-4)', fontSize: '13px' }}>Failed to load details</div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
