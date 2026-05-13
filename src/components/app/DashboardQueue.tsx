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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editSubject, setEditSubject] = useState('');

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
          setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'SENDING' } : i));
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
    if (item.coverLetter && item.coverLetter.length > 0) {
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
          setEditText(data.coverLetter || '');
          setEditSubject(data.subject || '');
          // Update local state
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
            <span className="chip chip-acid-soft"><span className="chip-dot live"></span>Auto-send active</span>
          </div>
          <div className="row gap-2">
            <span className="meta">{pendingCount} queued · {sentToday} sent today</span>
          </div>
        </div>
        <div>
          {items.length === 0 ? (
            <div style={{padding: '24px 16px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px'}}>
              No applications in queue. <a href="/dashboard/auto-apply" style={{color: 'var(--acid-deep)'}}>Set up auto-apply →</a>
            </div>
          ) : items.map((app, i) => (
            <div key={app.id} className="queue-row">
              <span className="indicator" style={{background: app.status === 'SENDING' ? 'var(--info)' : (app.matchScore && app.matchScore >= 80 ? 'var(--good)' : 'var(--ink-5)')}}></span>
              <div className="logo" style={{background: COLORS[i % COLORS.length]}}>{app.companyName[0]}</div>
              <div>
                <div className="title">{app.jobTitle} · {app.companyName}</div>
                <div className="meta">{timeAgo(app.createdAt)} ago</div>
              </div>
              <span className="match">{app.matchScore ? `${app.matchScore}% match` : ''}</span>
              <div className="actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => openEdit(app)}
                  disabled={!!loading[app.id]}
                >Edit draft</button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAction(app.id, 'send-now')}
                  disabled={!!loading[app.id]}
                >{loading[app.id] === 'send-now' ? 'Sending...' : 'Send now'}</button>
              </div>
            </div>
          ))}
          {pendingCount > items.length && (
            <div className="queue-row">
              <span className="indicator" style={{background: 'var(--ink-5)'}}></span>
              <div className="logo" style={{background: '#34D399'}}>+</div>
              <div>
                <div className="title">+{pendingCount - items.length} more queued</div>
                <div className="meta">will auto-send on schedule</div>
              </div>
              <span></span>
              <div className="actions">
                <a href="/dashboard/auto-apply" className="btn btn-ghost btn-sm">View all</a>
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
