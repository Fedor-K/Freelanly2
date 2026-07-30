'use client';

import { useState } from 'react';

type QueueItem = {
  id: string;
  companyName: string;
  jobTitle: string;
  matchScore: number | null;
  status: string;
  createdAt: string;
  coverLetter: string;
  subject: string;
  description?: string;
  location?: string;
  jobUrl?: string;
};

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function DashboardQueue({ items: initialItems, pendingCount, sentToday }: {
  items: QueueItem[];
  pendingCount: number;
  sentToday: number;
}) {
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editSubject, setEditSubject] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function handleAction(id: string, action: string) {
    setLoading(prev => ({ ...prev, [id]: action }));
    try {
      const res = await fetch(`/api/user/auto-apply/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        if (action === 'skip') {
          setItems(prev => prev.filter(i => i.id !== id));
        } else if (action === 'send-now') {
          // Instant send — show success then remove
          setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'SENT' } : i));
          setTimeout(() => {
            setItems(prev => prev.filter(i => i.id !== id));
          }, 2000);
        }
      } else {
        // Honest blocks (Postal bar, daily limit, dupe) come with a message — show it instead of a
        // mute FAILED flip, so the user knows WHAT to do (connect email / wait for reset).
        const data = await res.json().catch(() => ({} as { message?: string; error?: string }));
        if (data.message) {
          setErrors(prev => ({ ...prev, [id]: data.message }));
        } else {
          setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'FAILED' } : i));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(prev => ({ ...prev, [id]: '' }));
    }
  }

  async function openEdit(item: QueueItem) {
    setEditingId(item.id);
    const badPhrases = ['I am excited', 'I am eager', 'I am confident', 'I am writing to express'];
    const needsRegen = !item.coverLetter || item.coverLetter.length === 0 || badPhrases.some(p => item.coverLetter.includes(p));
    if (!needsRegen) {
      setEditText(item.coverLetter);
      setEditSubject(item.subject);
    } else {
      // Generate cover letter on the fly
      setEditText('Generating cover letter...');
      setEditSubject('Generating...');
      try {
        const res = await fetch(`/api/user/auto-apply/${item.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'regenerate' }),
        });
        if (res.ok) {
          const data = await res.json();
          // Add greeting + signature
          // AI generates complete email (greeting + body + signature)
          setEditText(data.coverLetter || '');
          setEditSubject(data.subject || '');
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, coverLetter: data.coverLetter, subject: data.subject } : i));
        } else {
          setEditText('Failed to generate. Try again.');
          setEditSubject('');
        }
      } catch {
        setEditText('Failed to generate. Try again.');
        setEditSubject('');
      }
    }
  }

  async function saveDraft() {
    if (!editingId) return;
    setLoading(prev => ({ ...prev, [editingId]: 'saving' }));
    try {
      await fetch(`/api/user/auto-apply/${editingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-draft', coverLetter: editText, subject: editSubject } as Record<string, string>),
      });
      setItems(prev => prev.map(i => i.id === editingId ? { ...i, coverLetter: editText, subject: editSubject } : i));
      setEditingId(null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(prev => ({ ...prev, [editingId!]: '' }));
    }
  }

  return (
    <>
      <div className="card">
        <div className="card-head">
          <div className="row gap-3">
            <h3>Today&apos;s queue</h3>
            <span className="chip chip-acid-soft"><span className="chip-dot live"></span>Ready to send</span>
          </div>
          <div className="row gap-2">
            <span className="meta">{pendingCount} queued · {sentToday} sent today</span>
          </div>
        </div>
        <div>
          {items.length === 0 ? (
            <div style={{padding: '24px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px'}}>
              No applications yet. <a href="/dashboard/discovery" style={{color: 'var(--acid-deep)'}}>Browse roles →</a>
            </div>
          ) : items.map((app, i) => (
            <div key={app.id} className="queue-row">
              <span className="indicator" style={{background: app.status === 'SENDING' ? 'var(--info)' : (app.matchScore && app.matchScore >= 80 ? 'var(--good)' : 'var(--ink-5)')}}></span>
              <div className="logo" style={{background: COLORS[i % COLORS.length]}}>{app.companyName[0]}</div>
              <div>
                <div className="title">{app.jobTitle} · {app.companyName}</div>
                <div className="meta" suppressHydrationWarning>{timeAgo(app.createdAt)} ago{app.location ? ` · ${app.location}` : ''}</div>
              </div>
              <span className="match">{app.matchScore ? `${app.matchScore}% match` : ''}</span>
              <div className="actions">
                {app.description && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setExpandedId(prev => prev === app.id ? null : app.id)}
                    title="Read the job description before sending"
                  >{expandedId === app.id ? 'Hide job' : 'View job'}</button>
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleAction(app.id, 'skip')}
                  disabled={!!loading[app.id] || app.status === 'SENT'}
                  title="Not interested — remove from queue"
                >{loading[app.id] === 'skip' ? '…' : 'Skip'}</button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => openEdit(app)}
                  disabled={!!loading[app.id]}
                >Edit draft</button>
                <button
                  className={`btn btn-sm ${app.status === 'SENT' ? 'btn-ghost' : app.status === 'FAILED' ? 'btn-ghost' : 'btn-primary'}`}
                  onClick={() => handleAction(app.id, 'send-now')}
                  disabled={!!loading[app.id] || app.status === 'SENT'}
                >{app.status === 'SENT' ? '✓ Sent!' : app.status === 'FAILED' ? '✗ Failed' : loading[app.id] === 'send-now' ? 'Sending...' : 'Send now'}</button>
              </div>
              {errors[app.id] && (
                <div style={{ gridColumn: '1 / -1', fontSize: '12.5px', color: '#92400E', background: '#FFF8EC', border: '1px solid #F2D9A8', borderRadius: '8px', padding: '8px 10px', marginTop: '6px', lineHeight: 1.5 }}>
                  {errors[app.id]}
                </div>
              )}
              {expandedId === app.id && app.description && (
                <div style={{ gridColumn: '1 / -1', marginTop: '8px', padding: '12px 14px', background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)' }}>
                  <div style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-wrap', maxHeight: '320px', overflow: 'auto' }}>{app.description}</div>
                  {app.jobUrl && (
                    <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '10px', fontSize: '12.5px', color: 'var(--acid-deep)' }}>Open original posting →</a>
                  )}
                </div>
              )}
            </div>
          ))}
          {pendingCount > items.length && (
            <div className="queue-row">
              <span className="indicator" style={{background: 'var(--ink-5)'}}></span>
              <div className="logo" style={{background: '#34D399'}}>+</div>
              <div>
                <div className="title">+{pendingCount - items.length} more queued</div>
                <div className="meta">waiting for your review</div>
              </div>
              <span></span>
              <div className="actions">
                <a href="/dashboard/discovery" className="btn btn-ghost btn-sm">View all</a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit draft modal */}
      {editingId && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'grid', placeItems: 'center'}} onClick={() => setEditingId(null)}>
          <div style={{background: 'var(--bg-1)', borderRadius: 'var(--r-lg)', padding: '28px', width: '100%', maxWidth: '600px', maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--line-2)'}} onClick={e => e.stopPropagation()}>
            <h3 style={{marginBottom: '16px'}}>Edit draft</h3>
            <label style={{fontSize: '12px', color: 'var(--ink-3)', fontFamily: "'Geist Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px'}}>Subject</label>
            <input
              value={editSubject}
              onChange={e => setEditSubject(e.target.value)}
              style={{width: '100%', padding: '10px 12px', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', fontSize: '14px', marginBottom: '16px', background: 'var(--bg)'}}
            />
            <label style={{fontSize: '12px', color: 'var(--ink-3)', fontFamily: "'Geist Mono', monospace", letterSpacing: '0.06em', textTransform: 'uppercase', display: 'block', marginBottom: '6px'}}>Cover letter</label>
            <textarea
              value={editText}
              onChange={e => setEditText(e.target.value)}
              rows={8}
              style={{width: '100%', padding: '12px', border: '1px solid var(--line-2)', borderRadius: 'var(--r-md)', fontSize: '14px', lineHeight: 1.6, resize: 'vertical', background: 'var(--bg)'}}
            />
            <div className="row gap-2" style={{marginTop: '16px', justifyContent: 'flex-end'}}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveDraft} disabled={loading[editingId] === 'saving'}>
                {loading[editingId] === 'saving' ? 'Saving...' : 'Save draft'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
