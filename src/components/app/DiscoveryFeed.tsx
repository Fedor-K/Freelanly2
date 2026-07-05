'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTracker } from '@/hooks/useTracker';

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
  githubVerified?: boolean;
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

export function DiscoveryFeed({ items: initial, topSkills, sourceCounts, hasApplied = true, loopIds = [], autoApplyOn = true, vettedFeed = false, vetStatus = null, hasSmtp = false, strongCount = 0 }: {
  items: Job[];
  topSkills: [string, number][];
  sourceCounts: [string, number][];
  hasApplied?: boolean;
  loopIds?: string[];
  autoApplyOn?: boolean;
  vettedFeed?: boolean;
  vetStatus?: { approved: number; remaining: number; poolSize: number } | null;
  hasSmtp?: boolean;
  strongCount?: number;
}) {
  // No useState wrapper: router.refresh() re-renders the server component with fresh items and the
  // vetted-feed polling relies on props actually updating.
  const items = initial;
  const router = useRouter();
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
  const [newMatches, setNewMatches] = useState(0);
  useEffect(() => {
    // The feed arrives full (server-rendered, hybrid vetted+fill) — no intro screen. Kick one
    // background vetting slice to grow the wall-proof vetted core, then refresh once it lands.
    if (vettedFeed && vetStatus && vetStatus.remaining > 0) {
      let stop = false;
      (async () => {
        try {
          const res = await fetch('/api/user/feed-vet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxPairs: 24 }) });
          if (res.ok && !stop) { const st = await res.json(); if (st.vettedNow > 0) router.refresh(); }
        } catch { /* the freshness poll will pick it up */ }
      })();
      return () => { stop = true; };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Freshness poll while the tab is open: newly-ingested opportunities get vetted for this user in
  // the background; when new approvals appear, offer a refresh instead of yanking the list around.
  useEffect(() => {
    if (!vettedFeed) return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch('/api/user/feed-vet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ maxPairs: 8 }) });
        if (!res.ok) return;
        const st = await res.json();
        const shown = items.filter(i => i.applyEmail).length;
        if (st.approved > shown) setNewMatches(st.approved - shown);
      } catch { /* next tick */ }
    }, 90000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vettedFeed]);
  const { track } = useTracker();

  // One impression event per feed mount: how many ATS (autofill-beta) cards this render contains —
  // the denominator for the /autofill fake-door test.
  const atsShownLogged = useRef(false);
  useEffect(() => {
    if (atsShownLogged.current) return;
    const n = items.filter(i => i.applyUrl && !i.applyEmail).length;
    if (n > 0) {
      atsShownLogged.current = true;
      track('FUNNEL_STEP', { step: 'ats_cards_shown', n });
    }
  }, [items, track]);

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
        const BLOCKING = ['poor_match', 'already_applied', 'limit_reached', 'resume_required', 'unavailable', 'smtp_required'];
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

  // Draft modal state
  const [draftItem, setDraftItem] = useState<Job | null>(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftGenerating, setDraftGenerating] = useState(false);
  const [draftSending, setDraftSending] = useState(false);
  // The apply-gate refused (or the state blocks applying) — show an HONEST message, not a writable
  // "Failed to generate" draft the user could still send. poor_match is the feed↔gate divergence.
  const [draftBlocked, setDraftBlocked] = useState<{ reason: string; message: string } | null>(null);

  // The feed is a curated best-first shortlist (Strong → divider → Good); a chronological "Newest"
  // sort broke the tiering and pulled fresh-but-irrelevant roles up, so the toggle was removed.
  const sortBy = 'match' as const;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showSimilar, setShowSimilar] = useState(false); // similar (non-100%) opps are opt-in via a button

  // Apply filters
  let visible = items.filter(i => !skipped.has(i.id));
  if (activeSkills.size > 0) {
    visible = visible.filter(i => i.skills.some(s => activeSkills.has(s)));
  }

  // Sort: manual skill filter re-ranks by picked-skill overlap; otherwise keep the server's
  // profile-fit ranking (Strong → Good, tiered) as-is.
  if (activeSkills.size > 0) {
    visible.sort((a, b) => {
      const aMatch = a.skills.filter(s => activeSkills.has(s)).length;
      const bMatch = b.skills.filter(s => activeSkills.has(s)).length;
      return bMatch - aMatch;
    });
  }

  // The feed leads with verified matches; the unverified "similar" (not-100%) opps are split out and
  // only shown when the user opts in via a button. Other sort modes show everything inline.
  const inMatchMode = sortBy === 'match' && activeSkills.size === 0;
  const verifiedCount = visible.filter(isVerified).length;
  const verifiedVisible = inMatchMode ? visible.filter(isVerified) : visible;
  const similarVisible = inMatchMode ? visible.filter(i => !isVerified(i)) : [];

  // First-apply nudge for fresh (profile-only) signups, shown only until the first apply. (The
  // duplicate "Your best match" hero was removed — it just repeated the feed's first card.)
  const showFirstApply = !hasApplied && applied.size === 0 && visible.length > 0;

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
          {item.githubVerified && (
            <span className="chip chip-good" style={{fontSize: '10px'}} title="A skill this role needs is backed by this candidate's public GitHub">
              ⚡ GitHub-verified
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
                // ATS role — autofill-beta fake door: measures demand for 1-click form autofill before
                // the extension exists. The lander keeps the real apply path open (continue to site).
                <a
                  className="btn btn-primary btn-sm"
                  href={`/autofill?opp=${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('FUNNEL_STEP', { step: 'autofill_beta_click', opportunityId: item.id, surface: 'card' })}
                >
                  Apply with 1-click autofill ✨
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
        {activeSkills.size > 0 && (
          <div className="filter-section">
            <button className="btn btn-soft" style={{width: '100%'}} onClick={() => setActiveSkills(new Set())}>Reset filters</button>
          </div>
        )}
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

        {newMatches > 0 && (
          <div style={{ padding: '10px 20px', background: '#F2FADD', borderBottom: '1px solid #D8EEAA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#3A7D00' }}>{newMatches} new verified {newMatches === 1 ? 'match' : 'matches'} for you</span>
            <button className="btn btn-soft btn-sm" onClick={() => { setNewMatches(0); router.refresh(); }}>Refresh</button>
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

        {vettedFeed && visible.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '17px', fontWeight: 600, marginBottom: '8px' }}>No verified matches for your profile right now</div>
            <div style={{ fontSize: '13.5px', color: 'var(--ink-4)', maxWidth: '460px', margin: '0 auto 16px', lineHeight: 1.55 }}>
              Every card here is pre-checked by AI against your profile — we only show roles you can actually be sent to.
              New projects arrive daily; we&apos;ll keep checking them for you.
            </div>
            <a className="btn btn-acid btn-sm" href="/dashboard/settings#profile">Improve my profile</a>
          </div>
        ) : visible.length === 0 ? (
          <div style={{padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: '13px'}}>
            No opportunities match your filters. Try removing a skill filter.
          </div>
        ) : (
          <>
            {verifiedVisible.map((item, i) => {
              // Divider between the STRONG tier (sent from our name) and the Good/rest tier (needs the
              // user's own SMTP). Server orders Strong-first, so insert it before the first non-Strong
              // card — only for users who haven't connected SMTP.
              const showDivider = !hasSmtp && item.matchLabel !== 'Strong' && (i === 0 || verifiedVisible[i - 1].matchLabel === 'Strong');
              return (
                <div key={item.id}>
                  {showDivider && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', padding: '16px 20px', margin: '4px 0', background: 'linear-gradient(90deg,#F2FADD,#EAF7C0)', borderTop: '1px solid #D8EEAA', borderBottom: '1px solid #D8EEAA' }}>
                      <span style={{ fontSize: '22px' }}>✉️</span>
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#2E3A00' }}>{strongCount > 0 ? 'To apply to the roles below, send from your own email' : 'Send from your own email — unlimited'}</div>
                        <div style={{ fontSize: '12.5px', color: '#5A6B1E', lineHeight: 1.5 }}>We send only your strongest matches from Freelanly. Connect your inbox to apply to these too — from your address, no daily cap, better replies.</div>
                      </div>
                      <a className="btn btn-acid btn-sm" href="/dashboard/settings#integrations" onClick={() => track('FUNNEL_STEP', { step: 'smtp_banner_click', surface: 'feed_divider' })}>Connect my email →</a>
                    </div>
                  )}
                  {renderCard(item, i)}
                </div>
              );
            })}
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
            ) : draftBlocked && (draftBlocked.reason === 'smtp_required' || draftBlocked.reason === 'not_strong' || draftBlocked.reason === 'limit_reached') ? (
              <div style={{padding: '40px 28px', textAlign: 'center'}}>
                <div style={{fontSize: '24px', marginBottom: '10px'}}>✉️</div>
                <div style={{fontSize: '15px', fontWeight: 600, marginBottom: '10px'}}>
                  {draftBlocked.reason === 'limit_reached' ? 'Daily free limit reached' : 'Send this from your own email'}
                </div>
                <div style={{fontSize: '13px', color: '#5C6068', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 22px'}}>
                  {draftBlocked.message || 'We send our strongest matches from Freelanly. Connect your own inbox to send this — and anything — yourself, from your address, with no limits and better replies.'}
                </div>
                <a className="btn btn-acid btn-sm" href="/dashboard/settings#integrations" style={{marginRight: '8px'}}>Connect my email →</a>
                <button className="btn btn-ghost btn-sm" onClick={() => setDraftItem(null)}>Not now</button>
              </div>
            ) : draftBlocked ? (
              <div style={{padding: '44px 24px', textAlign: 'center'}}>
                <div style={{fontSize: '15px', fontWeight: 600, marginBottom: '10px'}}>
                  {draftBlocked.reason === 'poor_match' ? 'Not a strong match for your profile'
                    : draftBlocked.reason === 'already_applied' ? 'You already applied to this one'
                    : draftBlocked.reason === 'resume_required' ? 'Add your résumé first'
                    : draftBlocked.reason === 'unavailable' ? 'This role is no longer available'
                    : "Can't apply to this one"}
                </div>
                <div style={{fontSize: '13px', color: '#5C6068', lineHeight: 1.6, maxWidth: '440px', margin: '0 auto 22px'}}>
                  {draftBlocked.reason === 'poor_match'
                    ? (draftBlocked.message || "Not a strong match — but you can send it yourself. Connect your own email to apply here (and anywhere) with no limits.")
                    : (draftBlocked.message || 'Applying to this role is not available right now.')}
                </div>
                {draftBlocked.reason === 'poor_match' && (
                  <a className="btn btn-acid btn-sm" href="/dashboard/settings#integrations" style={{marginRight: '8px'}}>Connect my email →</a>
                )}
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
