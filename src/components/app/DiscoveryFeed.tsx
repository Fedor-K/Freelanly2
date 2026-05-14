'use client';

import { useState } from 'react';

type Job = {
  id: string;
  type: 'opportunity' | 'job';
  title: string;
  companyName: string;
  description: string;
  source: string;
  createdAt: string;
  skills: string[];
  location: string | null;
  applyEmail: string | null;
};

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function DiscoveryFeed({ items: initial, total, topSkills, sourceCounts }: {
  items: Job[];
  total: number;
  topSkills: [string, number][];
  sourceCounts: [string, number][];
}) {
  const [items] = useState(initial);
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [activeSkills, setActiveSkills] = useState<Set<string>>(new Set());

  async function handleApply(item: Job) {
    if (!item.applyEmail) return;
    setLoading(prev => ({ ...prev, [item.id]: 'apply' }));
    try {
      const res = await fetch('/api/user/quick-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: item.type === 'opportunity' ? item.id : undefined,
          jobId: item.type === 'job' ? item.id : undefined,
        }),
      });
      if (res.ok) {
        setApplied(prev => new Set(prev).add(item.id));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to apply');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(prev => ({ ...prev, [item.id]: '' }));
    }
  }

  function toggleSkill(skill: string) {
    setActiveSkills(prev => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill); else next.add(skill);
      return next;
    });
  }

  // Apply filters
  let visible = items.filter(i => !skipped.has(i.id));
  if (activeSkills.size > 0) {
    visible = visible.filter(i => i.skills.some(s => activeSkills.has(s)));
  }

  return (
    <>
      {/* Filters sidebar */}
      <aside className="card" style={{position: 'sticky', top: '72px'}}>
        <div className="filter-section">
          <h4>Tech / Skills</h4>
          <div className="filter-list">
            {topSkills.map(([skill, count]) => (
              <div
                key={skill}
                className={`filter-item${activeSkills.has(skill) ? ' on' : ''}`}
                onClick={() => toggleSkill(skill)}
              >
                <div className="left"><span className="cb"></span>{skill}</div>
                <span className="count">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="filter-section">
          <h4>Source</h4>
          <div className="filter-list">
            {sourceCounts.map(([src, count]) => (
              <div key={src} className="filter-item on">
                <div className="left"><span className="cb"></span>{src}</div>
                <span className="count">{count}</span>
              </div>
            ))}
          </div>
        </div>
        {activeSkills.size > 0 && (
          <div className="filter-section">
            <button className="btn btn-soft" style={{width: '100%'}} onClick={() => setActiveSkills(new Set())}>Reset all filters</button>
          </div>
        )}
      </aside>

      {/* Results */}
      <div className="card">
        <div className="card-head">
          <div className="row gap-3">
            <h3>{visible.length} results</h3>
            <span className="chip chip-acid-soft"><span className="chip-dot live"></span>Live feed</span>
          </div>
          <div className="row gap-2">
            <span className="muted f-mono" style={{fontSize: '11px'}}>Sort:</span>
            <div className="seg">
              <button className="active">Newest</button>
              <button>Best match</button>
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <div style={{padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px'}}>
            No opportunities match your filters. Try removing a skill filter.
          </div>
        ) : visible.map((item, i) => (
          <div key={item.id} className="job-card" style={{cursor: 'default'}}>
            <div className="logo" style={{background: COLORS[i % COLORS.length]}}>{item.companyName[0]}</div>
            <div>
              <div className="row gap-2">
                <div className="job-title">{item.title}</div>
                <span className="chip"><span className="chip-dot live"></span>{timeAgo(item.createdAt)}</span>
              </div>
              <div className="job-company">{item.companyName} · {item.source === 'linkedin' ? 'via LinkedIn' : item.source}</div>
              <div className="job-snippet">{item.description.slice(0, 160)}{item.description.length > 160 ? '...' : ''}</div>
              <div className="job-meta">
                {item.skills.slice(0, 5).map(s => (
                  <span key={s} className={`tag${activeSkills.has(s) ? ' tag-acid' : ''}`}>{s}</span>
                ))}
                {item.location && <span className="tag">{item.location}</span>}
              </div>
            </div>
            <div className="job-right">
              <div className="job-actions">
                {applied.has(item.id) ? (
                  <span className="chip chip-good" style={{fontSize: '11px'}}>✓ Applied</span>
                ) : (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSkipped(prev => new Set(prev).add(item.id))}>Skip</button>
                    {item.applyEmail ? (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleApply(item)}
                        disabled={!!loading[item.id]}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        {loading[item.id] === 'apply' ? 'Applying...' : 'Apply'}
                      </button>
                    ) : (
                      <span className="meta" style={{fontSize: '11px'}}>No email</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}

        {total > visible.length + skipped.size && (
          <div style={{padding: '14px 20px', textAlign: 'center'}}>
            <a href="/dashboard/discovery" className="btn btn-soft">Load more results</a>
          </div>
        )}
      </div>
    </>
  );
}
