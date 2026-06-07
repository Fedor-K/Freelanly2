'use client';

import { useMemo, useState } from 'react';
import { RIcon } from '../icons';
import { useCabinet, type Density } from '../RecruiterCabinet';
import { CandidateCard } from '../parts';
import type { Strength } from '../lib';

const DENSITIES: { d: Density; label: string }[] = [
  { d: 'comfortable', label: 'Comfortable' },
  { d: 'dense', label: 'Compact' },
  { d: 'detailed', label: 'Cards' },
];

export function CandidatesView() {
  const { groups, candidates, density, setDensity, roleFilter, setRoleFilter, openPaywall } = useCabinet();
  const [strengths, setStrengths] = useState<Set<Strength>>(new Set<Strength>(['Strong', 'Good', 'Weak', null]));

  const newCount = candidates.filter((c) => {
    const h = (Date.now() - new Date(c.createdAt).getTime()) / 3600000;
    return h <= 6;
  }).length;

  const strengthCounts = useMemo(() => {
    const m: Record<string, number> = { Strong: 0, Good: 0, Weak: 0 };
    for (const c of candidates) if (c.strength) m[c.strength] = (m[c.strength] || 0) + 1;
    return m;
  }, [candidates]);

  function toggleStrength(s: Strength) {
    setStrengths((prev) => { const n = new Set(prev); if (n.has(s)) n.delete(s); else n.add(s); return n; });
  }

  const visibleGroups = groups
    .filter((g) => roleFilter === 'all' || g.key === roleFilter)
    .map((g) => ({ ...g, items: g.items.filter((c) => strengths.has(c.strength ?? null)) }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h1>Candidates</h1>
          <p>{candidates.length} applicant{candidates.length === 1 ? '' : 's'} across your {groups.length} role{groups.length === 1 ? '' : 's'}, sorted by match strength.{newCount > 0 && <> <b>{newCount} new</b> in the last 6 hours.</>}</p>
        </div>
        <div className="page-actions">
          <div className="seg">
            {DENSITIES.map(({ d, label }) => (
              <button key={d} className={density === d ? 'active' : ''} onClick={() => setDensity(d)}>{label}</button>
            ))}
          </div>
          <a href="#" className="btn btn-acid btn-sm" onClick={(e) => { e.preventDefault(); openPaywall(); }}><RIcon name="search" size={14} /> Search full pool</a>
        </div>
      </div>

      <div className="cand-grid">
        {/* filters */}
        <aside className="card" style={{ position: 'sticky', top: '72px' }}>
          <div className="fseg">
            <h4>Role</h4>
            <div className="filter-list">
              <div className={`fitem${roleFilter === 'all' ? ' on' : ''}`} onClick={() => setRoleFilter('all')}>
                <div className="left"><span className="cb" />All roles</div><span className="count">{candidates.length}</span>
              </div>
              {groups.map((g) => (
                <div key={g.key} className={`fitem${roleFilter === g.key ? ' on' : ''}`} onClick={() => setRoleFilter(g.key)}>
                  <div className="left"><span className="cb" /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.jobTitle}</span></div>
                  <span className="count">{g.items.length}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="fseg">
            <h4>Match strength</h4>
            <div className="filter-list">
              {(['Strong', 'Good', 'Weak'] as const).map((s) => (
                <div key={s} className={`fitem${strengths.has(s) ? ' on' : ''}`} onClick={() => toggleStrength(s)}>
                  <div className="left"><span className="cb" /><span className={`match-badge match-${s.toLowerCase()}`} style={{ height: '18px', padding: '0 8px' }}><span className="dot" />{s}</span></div>
                  <span className="count">{strengthCounts[s] || 0}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="fseg">
            <button className="btn btn-soft btn-sm" style={{ width: '100%' }} onClick={() => { setRoleFilter('all'); setStrengths(new Set<Strength>(['Strong', 'Good', 'Weak', null])); }}>Reset filters</button>
          </div>
        </aside>

        {/* results */}
        <div>
          {candidates.length === 0 ? (
            <div className="card"><div className="empty-state">
              <div className="empty-ico"><RIcon name="users" size={26} /></div>
              <h3>No applications yet</h3>
              <p>As freelancers auto-apply to your roles through Freelanly, they&rsquo;ll appear here — ranked by match strength. Most roles see their first applicants within a few hours.</p>
            </div></div>
          ) : visibleGroups.length === 0 ? (
            <div className="card"><div className="empty-state">
              <div className="empty-ico"><RIcon name="users" size={26} /></div>
              <h3>No candidates match these filters</h3>
              <p>Adjust the role or match-strength filters on the left to see more applicants.</p>
            </div></div>
          ) : visibleGroups.map((g) => (
            <div key={g.key} className="role-group">
              <div className="role-head">
                <div className="ico"><RIcon name="briefcase" size={16} /></div>
                <div>
                  <h3>{g.jobTitle}</h3>
                  <div className="sub">{g.items.length} applicant{g.items.length === 1 ? '' : 's'}</div>
                </div>
                <div className="right">
                  <span className="chip">{g.items.length}</span>
                </div>
              </div>
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="cand-list">
                  {g.items.map((c) => <CandidateCard key={c.appId} c={c} />)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
