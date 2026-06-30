'use client';

import { useState, useEffect } from 'react';
import { useTracker } from '@/hooks/useTracker';
import { ProcessingScreen } from '@/components/ProcessingScreen';

const DISCOVERY_SCAN_STEPS = [
  { title: 'Scanning the feed…', sub: 'Reading the freshest gigs' },
  { title: 'Matching to your profile…', sub: 'Skills, role, languages, location' },
  { title: 'Ranking your matches…', sub: 'Strongest fits first' },
];

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
  applyUrl: string | null;
  matchLabel: 'Strong' | 'Good' | 'Weak';
  aiVerified: boolean;
  alreadyApplied: boolean;
  matchScore: number;
  matchedSkills: string[];
  matchedTitleTokens: string[];
  languageGap: string[];
  missingCore: string[];
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// A verified match = the auto-apply matcher actually vetted it (Strong or Good). Only these are
// badged; everything else is an unbadged "closest opportunity" for browsing.
const isVerified = (i: Job) => i.aiVerified;

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

export function DiscoveryFeed({ items: initial, topSkills, sourceCounts, hasApplied = true, loopIds = [], autoApplyOn = true }: {
  items: Job[];
  topSkills: [string, number][];
  sourceCounts: [string, number][];
  hasApplied?: boolean;
  loopIds?: string[];
  autoApplyOn?: boolean;
}) {
  const [items] = useState(initial);
  const [loading, setLoading] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  // Auto-apply onboarding: most users sign up EXPECTING auto-apply, but it's now opt-in (loops default
  // MANUAL). Make that explicit + one-click to turn on, right here — not buried in settings.
  const [autoState, setAutoState] = useState<'off' | 'saving' | 'on' | 'dismissed'>(autoApplyOn ? 'on' : 'off');
  async function enableAutoApply() {
    setAutoState('saving');
    try {
      // single tracked call: flips all loops to AUTO + logs AUTO_APPLY_ENABLED{source}
      await fetch('/api/user/enable-auto-apply', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'discovery_onboard' }),
      });
      setAutoState('on');
    } catch { setAutoState('off'); }
  }
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [activeSkills, setActiveSkills] = useState<Set<string>>(new Set());
  // The feed is built server-side and arrives instantly, so a route-loading screen just flashes. Show
  // a guaranteed ~2.2s "scanning the feed" intro on mount instead, so the search animation is actually seen.
  const [intro, setIntro] = useState(true);
  useEffect(() => { const t = setTimeout(() => setIntro(false), 3500); return () => clearTimeout(t); }, []);
  const { track } = useTracker();

  async function handleApply(item: Job) {
    if (!item.applyEmail) return;
    // Funnel step 1 — user pressed Apply in the feed (this surface was previously untracked).
    track('OPPORTUNITY_APPLY_CLICK', { method: 'feed', opportunityId: item.type === 'opportunity' ? item.id : undefined, jobId: item.type === 'job' ? item.id : undefined, title: item.title });
    setDraftItem(item);
    setDraftSubject('');
    setDraftBody('');
    setDraftBlocked(null);
    setDraftGenerating(true);

    const startedAt = Date.now();
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
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      // Funnel step 2 — did the draft generate? Capture the REASON on failure (poor_match / already_applied
      // / limit_reached / resume_required / unavailable) so we can tell gate-rejections from real errors.
      track('APPLY_DRAFT', { method: 'feed', ok: res.ok, status: res.status, reason: (data as { error?: string }).error || null, ms: Date.now() - startedAt, opportunityId: item.type === 'opportunity' ? item.id : undefined });
      if (res.ok) {
        setDraftSubject((data as { subject?: string }).subject || `Application: ${item.title}`);
        setDraftBody((data as { coverLetter?: string }).coverLetter || '');
      } else {
        // Gate/state refusals are HONEST blocks — don't present a writable failed draft (the user
        // would just send garbage to a recruiter on a role the gate already rejected). Recoverable
        // errors (network/5xx) still fall through to a manual-write draft.
        const reason = (data as { error?: string }).error || '';
        const message = (data as { message?: string }).message || '';
        const BLOCKING = ['poor_match', 'already_applied', 'limit_reached', 'resume_required', 'unavailable'];
        if (BLOCKING.includes(reason)) {
          setDraftBlocked({ reason, message });
          // Server reports we've already applied here (it checks ALL of the user's applications, not just
          // the feed's queueable set — so the card can still show "Apply"). Flip it to the Applied state
          // now: the button turns into "✓ Applied" and can't be re-clicked into the same wall. This was
          // ~1/3 of all feed already_applied events (repeat clicks on the same card).
          if (reason === 'already_applied') setApplied(prev => new Set(prev).add(item.id));
        } else {
          setDraftBody(message || reason || 'Couldn\'t generate a draft — you can write your own below.');
          setDraftSubject(`Application: ${item.title}`);
        }
      }
    } catch {
      track('APPLY_DRAFT', { method: 'feed', ok: false, ms: Date.now() - startedAt, error: 'network' });
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
        // Funnel step 3 — the draft was actually sent (completes feed click → draft → send).
        track('QUICK_APPLY', { method: 'feed', opportunityId: draftItem.type === 'opportunity' ? draftItem.id : undefined, jobId: draftItem.type === 'job' ? draftItem.id : undefined });
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
  // The apply-gate refused (or the state blocks applying) — show an HONEST message, not a writable
  // "Failed to generate" draft the user could still send. poor_match is the feed↔gate divergence.
  const [draftBlocked, setDraftBlocked] = useState<{ reason: string; message: string } | null>(null);

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
  const [showSimilar, setShowSimilar] = useState(false); // similar (non-100%) opps are opt-in via a button

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

  // The feed leads with verified matches; the unverified "similar" (not-100%) opps are split out and
  // only shown when the user opts in via a button. Other sort modes show everything inline.
  const inMatchMode = sortBy === 'match' && activeSkills.size === 0;
  const verifiedCount = visible.filter(isVerified).length;
  const verifiedVisible = inMatchMode ? visible.filter(isVerified) : visible;
  const similarVisible = inMatchMode ? visible.filter(i => !isVerified(i)) : [];

  // First-apply driver for fresh (profile-only) signups: prominent hero on the single best applyable
  // match + a one-time nudge, both shown only until the user makes their first apply.
  const showFirstApply = !hasApplied && applied.size === 0 && visible.length > 0;
  const heroItem = showFirstApply
    ? (verifiedVisible.find(i => (i.applyEmail || i.applyUrl) && !applied.has(i.id)) || visible.find(i => i.applyEmail || i.applyUrl))
    : undefined;

  const renderCard = (item: Job, i: number) => (
    <div key={item.id} className="job-card" style={{cursor: 'default'}}>
      <div className="logo" style={{background: COLORS[i % COLORS.length]}}>{item.companyName[0]}</div>
      <div>
        <div className="row gap-2">
          <div className="job-title">{item.title}</div>
          {isVerified(item) && (
            <span className="chip chip-good" style={{fontSize: '10px'}}>
              {item.matchLabel === 'Strong' ? '★ Strong match · AI-checked' : '✓ Good match · AI-checked'}
            </span>
          )}
          <span className="chip"><span className="chip-dot live"></span>{timeAgo(item.createdAt)}</span>
        </div>
        <div className="job-company">{item.companyName} · {item.source === 'linkedin' ? 'via LinkedIn' : item.source}</div>
        {item.matchLabel !== 'Weak' && matchedItems(item).length > 0 && (
          <div style={{fontSize: '12px', color: 'var(--ink-4)', margin: '3px 0 2px'}}>
            <strong style={{color: 'var(--good, #2E7D32)', fontWeight: 600}}>Why you&apos;re seeing this:</strong>{' '}
            matches your {matchedItems(item).join(' · ')}
            {item.languageGap.length > 0 && (
              <span style={{color: '#B45309', fontWeight: 500}}> · but needs {item.languageGap.map(cap).join(', ')}, not in your profile</span>
            )}
            {item.languageGap.length === 0 && item.missingCore.length > 0 && (
              <span style={{color: '#B45309', fontWeight: 500}}> · missing {item.missingCore.slice(0, 2).join(', ')}</span>
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
          {applied.has(item.id) || item.alreadyApplied ? (
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
              ) : item.applyUrl ? (
                // ATS role — external apply on the company's site (no auto-send, no cover letter)
                <a
                  className="btn btn-primary btn-sm"
                  href={`/go/ats/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setApplied(prev => new Set(prev).add(item.id))}
                >
                  Apply on company site ↗
                </a>
              ) : (
                <span className="meta" style={{fontSize: '11px'}}>No email</span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  if (intro) {
    return (
      <div style={{ gridColumn: '1 / -1', display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <ProcessingScreen scan steps={DISCOVERY_SCAN_STEPS} emoji="🔍" note="Finding gigs that fit you…" />
      </div>
    );
  }

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

        {/* Auto-apply onboarding — most users sign up expecting auto-apply; make it explicit + 1-click on */}
        {(autoState === 'off' || autoState === 'saving') && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(11,12,15,0.07)', background: 'linear-gradient(90deg, rgba(199,241,53,0.16), rgba(199,241,53,0.04))' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--ink-1, #0B0C0F)', marginBottom: '4px' }}>Two ways to apply — your choice</div>
            <div style={{ fontSize: '13px', color: 'var(--ink-3, #3a3a3a)', lineHeight: 1.5, marginBottom: '12px' }}>
              <strong>Apply yourself</strong> — pick roles from the feed below (we pre-write the cover letter). Or turn on
              <strong> auto-apply</strong> and Freelanly applies for you, hands-free, to your strong matches.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-acid btn-sm" onClick={enableAutoApply} disabled={autoState === 'saving'}>
                {autoState === 'saving' ? 'Turning on…' : '⚡ Turn on auto-apply'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setAutoState('dismissed')}>I&apos;ll apply myself</button>
            </div>
          </div>
        )}
        {autoState === 'on' && !autoApplyOn && (
          <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(11,12,15,0.07)', background: 'rgba(199,241,53,0.10)', fontSize: '13px', fontWeight: 600, color: 'var(--ink-1, #0B0C0F)' }}>
            ✓ Auto-apply is on — we&apos;ll start applying to your strong matches. You can turn it off anytime in Settings.
          </div>
        )}

        {/* First-apply nudge — only until the user applies once */}
        {showFirstApply && !nudgeDismissed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', background: 'linear-gradient(90deg, rgba(199,241,53,0.18), rgba(199,241,53,0.05))', borderBottom: '1px solid rgba(11,12,15,0.07)' }}>
            <span style={{ fontSize: '20px' }}>👋</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink-1, #0B0C0F)' }}>Apply to your first role — it&apos;s free and takes ~30 seconds</div>
              <div style={{ fontSize: '12px', color: 'var(--ink-4)', marginTop: '2px' }}>We pre-write the cover letter. Just review and send.</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setNudgeDismissed(true)}>Dismiss</button>
          </div>
        )}

        {/* Best-match hero — single, prominent, one click to apply */}
        {showFirstApply && heroItem && (
          <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(11,12,15,0.07)', background: '#FBFAF6' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#7A8B1E', marginBottom: '8px' }}>★ Your best match</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
              <div className="logo" style={{ background: COLORS[0] }}>{heroItem.companyName[0]}</div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink-1, #0B0C0F)' }}>{heroItem.title}</div>
                <div style={{ fontSize: '13px', color: 'var(--ink-4)', marginTop: '2px' }}>
                  {heroItem.companyName}{matchedItems(heroItem).length > 0 && <> · {matchedItems(heroItem).slice(0, 3).join(' · ')}</>}
                </div>
              </div>
              {heroItem.applyEmail ? (
                <button className="btn btn-acid" onClick={() => handleApply(heroItem)} disabled={!!loading[heroItem.id]}>
                  Apply — ~30s →
                </button>
              ) : heroItem.applyUrl ? (
                <a className="btn btn-acid" href={`/go/ats/${heroItem.id}`} target="_blank" rel="noopener noreferrer" onClick={() => setApplied(prev => new Set(prev).add(heroItem.id))}>
                  Apply on company site ↗
                </a>
              ) : null}
            </div>
          </div>
        )}

        <div className="card-head">
          <div className="row gap-3">
            <h3>{inMatchMode && verifiedCount === 0 ? `${visible.length} similar` : `${visible.length} results`}</h3>
            {inMatchMode && verifiedCount > 0 && (
              <span className="chip chip-good" style={{fontSize: '11px'}}>★ {verifiedCount} verified match{verifiedCount === 1 ? '' : 'es'}</span>
            )}
            <span className="chip chip-acid-soft"><span className="chip-dot live"></span>Live feed</span>
            <button className="btn btn-ghost btn-sm disco-filter-toggle" onClick={() => setShowFilters(f => !f)}>{showFilters ? 'Hide filters' : 'Filters'}</button>
          </div>
          <div className="row gap-2">
            <span className="muted f-mono" style={{fontSize: '11px'}}>Sort:</span>
            <div className="seg">
              <button className={sortBy === 'match' ? 'active' : ''} onClick={() => setSortBy('match')}>My matches</button>
              <button className={sortBy === 'newest' ? 'active' : ''} onClick={() => setSortBy('newest')}>Newest</button>
            </div>
          </div>
        </div>

        {inMatchMode && verifiedCount === 0 && visible.length > 0 && (
          <div style={{padding: '16px 20px', borderBottom: '1px solid rgba(11,12,15,0.07)', background: '#FBFAF6'}}>
            <div style={{fontSize: '14px', fontWeight: 600, color: 'var(--ink-1, #0B0C0F)'}}>No strong matches right now</div>
            <div style={{fontSize: '12px', color: 'var(--ink-4)', marginTop: '3px', lineHeight: 1.5}}>
              The matcher hasn&apos;t verified a strong match for you in the current pool. Below are the
              closest opportunities — similar to your profile, but <strong>not verified matches</strong>.
              New gigs land every few hours, so check back.
            </div>
          </div>
        )}

        {visible.length === 0 ? (
          <div style={{padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px'}}>
            No opportunities match your filters. Try removing a skill filter.
          </div>
        ) : (
          <>
            {verifiedVisible.map((item, i) => renderCard(item, i))}
            {similarVisible.length > 0 && (
              <div style={{padding: '14px 20px', borderTop: '1px solid rgba(11,12,15,0.07)', textAlign: 'center'}}>
                <button className="btn btn-soft btn-sm" onClick={() => setShowSimilar(s => !s)}>
                  {showSimilar
                    ? 'Hide similar'
                    : `Show ${similarVisible.length} similar opportunit${similarVisible.length === 1 ? 'y' : 'ies'} (not 100% matches)`}
                </button>
              </div>
            )}
            {showSimilar && similarVisible.map((item, i) => renderCard(item, verifiedVisible.length + i))}
          </>
        )}
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
            ) : draftBlocked ? (
              <div style={{padding: '44px 24px', textAlign: 'center'}}>
                <div style={{fontSize: '15px', fontWeight: 600, marginBottom: '10px'}}>
                  {draftBlocked.reason === 'poor_match' ? 'Not a strong match for your profile'
                    : draftBlocked.reason === 'already_applied' ? 'You already applied to this one'
                    : draftBlocked.reason === 'limit_reached' ? 'Daily apply limit reached'
                    : draftBlocked.reason === 'resume_required' ? 'Add your résumé first'
                    : draftBlocked.reason === 'unavailable' ? 'This role is no longer available'
                    : "Can't apply to this one"}
                </div>
                <div style={{fontSize: '13px', color: '#5C6068', lineHeight: 1.6, maxWidth: '420px', margin: '0 auto 22px'}}>
                  {draftBlocked.reason === 'poor_match'
                    ? "Our matcher doesn't think this role fits your background well enough — we'd rather not send a weak application to the recruiter. Try the stronger matches at the top of your feed."
                    : (draftBlocked.message || 'Applying to this role is not available right now.')}
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setDraftItem(null)}>Got it</button>
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
