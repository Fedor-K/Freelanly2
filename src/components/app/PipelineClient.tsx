'use client';

import { useState } from 'react';

type DealApp = {
  id: string;
  companyName: string;
  jobTitle: string;
  matchScore: number | null;
  replyCategory: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
};

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

const STAGES = [
  { key: 'SENT', label: 'Outreach sent', dotColor: 'var(--s-sent)', next: 'OPENED' },
  { key: 'OPENED', label: 'Opened', dotColor: 'var(--s-opened)', next: 'REPLIED' },
  { key: 'REPLIED', label: 'Replied', dotColor: 'var(--s-replied)', next: 'INTERVIEW' },
  { key: 'INTERVIEW', label: 'Interview', dotColor: 'var(--s-booked)', next: 'OFFER' },
  { key: 'OFFER', label: 'Offer', dotColor: 'var(--s-offer)', next: null },
] as const;

function timeAgo(date: string | null): string {
  if (!date) return '';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// Map actual statuses to stage keys
function stageOf(status: string): string {
  if (['SENT', 'DELIVERED'].includes(status)) return 'SENT';
  return status;
}

export function PipelineClient({ apps: initial }: { apps: DealApp[] }) {
  const [apps, setApps] = useState(initial);
  const [moving, setMoving] = useState<string | null>(null);

  async function moveToStage(appId: string, newStatus: string) {
    setMoving(appId);
    try {
      const res = await fetch(`/api/user/auto-apply/${appId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move-stage', status: newStatus }),
      });
      if (res.ok) {
        setApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
      }
    } catch { /* ignore */ }
    finally { setMoving(null); }
  }

  return (
    <div className="kanban">
      {STAGES.map((stage, si) => {
        const stageApps = apps.filter(a => stageOf(a.status) === stage.key).slice(0, 6);
        const totalInStage = apps.filter(a => stageOf(a.status) === stage.key).length;

        return (
          <div key={stage.key} className="column">
            <div className="column-head">
              <div className="name"><span className="dot" style={{ background: stage.dotColor }}></span>{stage.label}</div>
              <span className="count">{totalInStage}</span>
            </div>
            <div className="column-body">
              {stageApps.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 8px', fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: 'var(--ink-4)' }}>No items</div>
              ) : stageApps.map((app, i) => (
                <div key={app.id} className="deal-card" style={stage.key === 'OFFER' ? { background: 'linear-gradient(180deg, rgba(199,249,74,0.08), var(--bg-0, #fff))', borderColor: 'var(--acid-deep)' } : undefined}>
                  <div className="top">
                    <div className="logo" style={{ background: COLORS[(si * 4 + i) % COLORS.length] }}>{app.companyName[0]}</div>
                    <div>
                      <div className="role">{app.jobTitle}</div>
                      <div className="co">{app.companyName}</div>
                    </div>
                  </div>
                  {app.replyCategory && (
                    <div className="tags">
                      <span className={`tag${['INTERESTED', 'INTERVIEW'].includes(app.replyCategory) ? ' tag-acid' : ''}`}>{app.replyCategory.toLowerCase()}</span>
                    </div>
                  )}
                  <div className="meta">
                    <span className="value">{app.matchScore ? `${app.matchScore}%` : ''}</span>
                    <span className="age">{timeAgo(app.sentAt || app.createdAt)}</span>
                  </div>
                  {stage.next && (
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%', marginTop: '8px', fontSize: '11px' }}
                      onClick={() => moveToStage(app.id, stage.next!)}
                      disabled={moving === app.id}
                    >
                      {moving === app.id ? 'Moving...' : `Move to ${STAGES.find(s => s.key === stage.next)?.label} →`}
                    </button>
                  )}
                </div>
              ))}
              {totalInStage > 6 && (
                <div style={{ textAlign: 'center', padding: '8px', fontFamily: "'Geist Mono', monospace", fontSize: '11px', color: 'var(--ink-4)' }}>+ {totalInStage - 6} more</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
