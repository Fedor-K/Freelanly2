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
  matchLabel: 'Strong' | 'Good' | 'Weak';
  matchScore: number;
  matchedSkills: string[];
  matchedTitleTokens: string[];
  languageGap: string[];
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// The concrete overlap between the role and the candidate's profile — the role's profession words
// plus the candidate's own skills found in it, as one deduped list (e.g. "Project Manager · Jira · Agile").
function matchedItems(item: Job): string[] {
  const role = item.matchedTitleTokens.map(cap).join(' '); // "project","manager" -> "Project Manager"
  const parts = [role, ...item.matchedSkills].filter(Boolean);
  const seen = new Set<string>();
  return parts.filter(s => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const COLORS = ['#FF6B6B','#A8E024','#6EE7FF','#FFB951','#A78BFA','#34D399','#F87171','#818CF8'];

function timeAgo(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function DiscoveryFeed({ items: initial, topSkills, sourceCounts }: {
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
    setDraftItem(item);
    setDraftSubject('');
    setDraftBody('');
    setDraftGenerating(true);

    try {
      const res = await fetch('/api/user/quick-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: item.type === 'opportunity' ? item.id : undefined,
          jobId: item.type === 'job' ? item.id : undefined,
          draftOnly: true,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDraftSubject(data.subject || `Application: ${item.title}`);
        setDraftBody(data.coverLetter || '');
      } else {
        const data = await res.json();
        setDraftBody(data.error || 'Failed to generate draft. You can write your own below.');
        setDraftSubject(`Application: ${item.title}`);
      }
    } catch {
      setDraftBody('Failed to generate. Write your cover letter below.');
      setDraftSubject(`Application: ${item.title}`);
    } finally {
      setDraftGenerating(false);
    }
  }

  async function handleSendDraft() {
    if (!draftItem) return;
    setDraftSending(true);
    try {
      const res = await fetch('/api/user/quick-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: draftItem.type === 'opportunity' ? draftItem.id : undefined,
          jobId: draftItem.type === 'job' ? draftItem.id : undefined,
          coverLetter: draftBody,
          subject: draftSubject,
        }),
      });
      if (res.ok) {
        setApplied(prev => new Set(prev).add(draftItem.id));
        setDraftItem(null);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to send');
      }
    } catch {
      alert('Network error');
    } finally {
      setDraftSending(false);
    }
  }

  function toggleSkill(skill: string) {
    setActiveSkills(prev => {
      const next = new Set(prev);
      if (next.has(skill)) next.delete(skill); else next.add(skill);
      return next;
    });
  }

  const [applyingAll, setApplyingAll] = useState(false);
  const [applyAllResult, setApplyAllResult] = useState<string | null>(null);

  // Draft modal state
  const [draftItem, setDraftItem] = useState<Job | null>(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [draftSending, setDraftSending] = useState(false);

  async function handleApplyAll() {
    const withEmail = visible.filter(i => i.applyEmail && !applied.has(i.id));
    if (withEmail.length === 0) { alert('No applicable jobs in current view'); return; }
    if (!confirm(`Apply to ${withEmail.length} jobs with AI cover letters?`)) return;
    setApplyingAll(true);
    let count = 0;
    for (const item of withEmail.slice(0, 10)) {
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
          count++;
        }
      } catch { /* continue */ }
    }
    setApplyAllResult(`Applied to ${count} jobs!`);
    setApplyingAll(false);
    setTimeout(() => setApplyAllResult(null), 5000);
  }

  const [sortBy, setSortBy] = useState<'newest' | 'match'>('match');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters
  let visible = items.filter(i => !skipped.has(i.id));
  if (activeSkills.size > 0) {
    visible = visible.filter(i => i.skills.some(s => activeSkills.has(s)));
  }

  // Sort
  if (sortBy === 'newest') {
    visible.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else if (activeSkills.size > 0) {
    // Manual skill filter is on → rank by how many of the picked skills each role matches.
    visible.sort((a, b) => {
      const aMatch = a.skills.filter(s => activeSkills.has(s)).length;
      const bMatch = b.skills.filter(s => activeSkills.has(s)).length;
      return bMatch - aMatch;
    });
  }
  // else: "My matches" with no manual filter → keep the server's profile fit ranking as-is.

  // In default "My matches" view the server already orders Strong → rest. Mark the boundary so we can
  // split the feed into a "Strong match" section and a "More opportunities" top-up below it.
  const inMatchMode = sortBy === 'match' && activeSkills.size === 0;
  const strongCount = visible.filter(i => i.matchLabel === 'Strong').length;
  const firstRestIdx = inMatchMode && strongCount > 0
    ? visible.findIndex(i => i.matchLabel !== 'Strong')
    : -1;

  return (
    <>
      {/* Filters sidebar */}
      <aside className={`card${showFilters ? ' show' : ''}`} style={{position: 'sticky', top: '72px'}}>
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
        <div className="filter-section">
          <button
            className="btn btn-acid"
            style={{width: '100%', marginBottom: '8px'}}
            onClick={handleApplyAll}
            disabled={applyingAll}
          >
            {applyingAll ? 'Applying...' : 'Auto-apply to all'}
          </button>
          {applyAllResult && <div style={{fontSize: '12px', color: 'var(--good)', textAlign: 'center'}}>{applyAllResult}</div>}
          {activeSkills.size > 0 && (
            <button className="btn btn-soft" style={{width: '100%', marginTop: '8px'}} onClick={() => setActiveSkills(new Set())}>Reset filters</button>
          )}
        </div>
      </aside>

      {/* Results */}
      <div className="card">
        <div className="card-head">
          <div className="row gap-3">
            <h3>{visible.length} results</h3>
            {inMatchMode && strongCount > 0 && (
              <span className="chip chip-good" style={{fontSize: '11px'}}>★ {strongCount} strong match{strongCount === 1 ? '' : 'es'}</span>
            )}
            <span className="chip chip-acid-soft"><span className="chip-dot live"></span>Live feed</span>
            <button className="btn btn-ghost btn-sm disco-filter-toggle" onClick={() => setShowFilters(f => !f)}>{showFilters ? 'Hide filters' : 'Filters'}</button>
          </div>
          <div className="row gap-2">
            <span className="muted f-mono" style={{fontSize: '11px'}}>Sort:</span>
            <div className="seg">
              <button className={sortBy === 'match' ? 'active' : ''} onClick={() => setSortBy('match')}>My matches</button>
              <button className={sortBy === 'newest' ? 'active' : ''} onClick={() => setSortBy('newest')}>All</button>
            </div>
          </div>
        </div>

        {visible.length === 0 ? (
          <div style={{padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px'}}>
            No opportunities match your filters. Try removing a skill filter.
          </div>
        ) : visible.map((item, i) => (
          <div key={item.id}>
            {i === firstRestIdx && (
              <div style={{padding: '10px 20px 4px', fontSize: '11px', fontFamily: "'Geist Mono', monospace", color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '1px solid rgba(11,12,15,0.07)'}}>
                More opportunities
              </div>
            )}
          <div className="job-card" style={{cursor: 'default'}}>
            <div className="logo" style={{background: COLORS[i % COLORS.length]}}>{item.companyName[0]}</div>
            <div>
              <div className="row gap-2">
                <div className="job-title">{item.title}</div>
                {item.matchLabel === 'Strong' && (
                  <span className="chip chip-good" style={{fontSize: '10px'}}>★ Strong match</span>
                )}
                <span className="chip"><span className="chip-dot live"></span>{timeAgo(item.createdAt)}</span>
              </div>
              <div className="job-company">{item.companyName} · {item.source === 'linkedin' ? 'via LinkedIn' : item.source}</div>
              {item.matchLabel !== 'Weak' && matchedItems(item).length > 0 && (
                <div style={{fontSize: '12px', color: 'var(--ink-4)', margin: '3px 0 2px'}}>
                  <strong style={{color: 'var(--good, #2E7D32)', fontWeight: 600}}>In your profile too:</strong>{' '}
                  {matchedItems(item).join(' · ')}
                  {item.languageGap.length > 0 && (
                    <span style={{color: '#B45309', fontWeight: 500}}> · but needs {item.languageGap.map(cap).join(', ')}, not in your profile</span>
                  )}
                </div>
              )}
              <div
                className="job-snippet"
                style={{cursor: 'pointer'}}
                onClick={() => setExpanded(prev => {
                  const next = new Set(prev);
                  if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                  return next;
                })}
              >
                {expanded.has(item.id) ? item.description : item.description.slice(0, 200)}
                {!expanded.has(item.id) && item.description.length > 200 ? <span style={{color: 'var(--acid-deep, #4D8B0A)', fontWeight: 500}}> ... read more ▸</span> : null}
                {expanded.has(item.id) && item.description.length > 200 ? <span style={{color: 'var(--ink-4)', fontWeight: 400}}> ▴ collapse</span> : null}
              </div>
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
          </div>
        ))}
      </div>

      {/* Draft preview modal */}
      {draftItem && (
        <div style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'grid', placeItems: 'center'}} onClick={() => !draftGenerating && !draftSending && setDraftItem(null)}>
          <div style={{background: '#fff', borderRadius: '14px', padding: '0', width: '100%', maxWidth: '640px', maxHeight: '85vh', overflow: 'auto', border: '1px solid rgba(11,12,15,0.12)'}} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{padding: '16px 24px', borderBottom: '1px solid rgba(11,12,15,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div>
                <div style={{fontSize: '15px', fontWeight: 500}}>{draftItem.title}</div>
                <div style={{fontSize: '12px', color: '#5C6068', marginTop: '2px'}}>{draftItem.companyName} · {draftItem.applyEmail}</div>
              </div>
              <button style={{background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#5C6068'}} onClick={() => setDraftItem(null)}>✕</button>
            </div>

            {draftGenerating ? (
              <div style={{padding: '60px 24px', textAlign: 'center', color: '#5C6068'}}>
                <div style={{fontSize: '14px', marginBottom: '8px'}}>Generating your cover letter...</div>
                <div style={{fontSize: '12px', color: '#8A8E96'}}>AI is reading the job post and matching with your profile</div>
              </div>
            ) : (
              <>
                {/* Subject */}
                <div style={{padding: '12px 24px', borderBottom: '1px solid rgba(11,12,15,0.07)', background: '#F7F6F1'}}>
                  <div style={{fontSize: '11px', fontFamily: "'Geist Mono', monospace", color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px'}}>Subject</div>
                  <input
                    value={draftSubject}
                    onChange={e => setDraftSubject(e.target.value)}
                    style={{width: '100%', border: 'none', background: 'none', fontSize: '14px', outline: 'none', fontFamily: "'Geist Mono', monospace"}}
                  />
                </div>

                {/* Body */}
                <div style={{padding: '20px 24px'}}>
                  <div style={{fontSize: '11px', fontFamily: "'Geist Mono', monospace", color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px'}}>Cover letter</div>
                  <textarea
                    value={draftBody}
                    onChange={e => setDraftBody(e.target.value)}
                    rows={10}
                    style={{width: '100%', border: '1px solid rgba(11,12,15,0.12)', borderRadius: '10px', padding: '14px', fontSize: '14px', lineHeight: 1.6, resize: 'vertical', outline: 'none', fontFamily: 'inherit'}}
                  />
                </div>

                {/* Actions */}
                <div style={{padding: '14px 24px', borderTop: '1px solid rgba(11,12,15,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{fontSize: '12px', color: '#8A8E96', fontFamily: "'Geist Mono', monospace"}}>{draftBody.length} chars</div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDraftItem(null)}>Cancel</button>
                    <button
                      className="btn btn-acid btn-sm"
                      onClick={handleSendDraft}
                      disabled={draftSending || !draftBody.trim()}
                      style={{display: 'flex', alignItems: 'center', gap: '6px'}}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                      {draftSending ? 'Sending...' : 'Send application'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
