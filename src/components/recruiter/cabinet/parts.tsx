'use client';

import { RIcon } from './icons';
import { useCabinet } from './RecruiterCabinet';
import {
  avColor, freshness, initials, intentOf, primaryLang, ringColor, shortTime,
  strengthClass, tidySkill, timeAgo, type RecruiterCandidate,
} from './lib';

const RING_C = 125.66; // circumference for r=20

export function FitRing({ score, strength, lg = false }: { score: number | null; strength: RecruiterCandidate['strength']; lg?: boolean }) {
  if (score == null) return null;
  const off = RING_C * (1 - Math.max(0, Math.min(100, score)) / 100);
  return (
    <div className={`fit-ring${lg ? ' lg' : ''}`}>
      <svg viewBox="0 0 46 46">
        <circle cx="23" cy="23" r="20" fill="none" stroke="var(--bg-2)" strokeWidth="3.5" />
        <circle cx="23" cy="23" r="20" fill="none" stroke={ringColor(strength ?? null)} strokeWidth="3.5"
          strokeDasharray={RING_C} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div className="val">{score}</div>
    </div>
  );
}

export function MatchBadge({ strength, label }: { strength: RecruiterCandidate['strength']; label?: string }) {
  if (!strength) return null;
  return <span className={`match-badge ${strengthClass(strength)}`}><span className="dot" />{label || `${strength} match`}</span>;
}

// Role-grouped candidate row (the Candidates screen). Whole card → detail; action column stops propagation.
export function CandidateCard({ c }: { c: RecruiterCandidate }) {
  const { colorIdx, openDetail, isRevealed, revealedEmail, revealing, doReveal, track } = useCabinet();
  const i = colorIdx[c.appId] ?? 0;
  const skills = c.profile.skills || [];
  const shown = skills.slice(0, 5);
  const extra = skills.length - shown.length;
  const fr = freshness(c.lastActiveAt);
  const lang = primaryLang(c.profile.languages);
  const revealed = isRevealed(c.appId);
  const email = revealedEmail(c.appId);

  return (
    <div className="cand-card" style={{ cursor: 'pointer' }} onClick={() => openDetail(c.appId)}>
      <div className="cand-av" style={{ background: avColor(i), backgroundImage: c.avatarUrl ? `url(${c.avatarUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>{c.avatarUrl ? '' : initials(c.name)}</div>
      <div className="cand-main">
        <div className="cand-head">
          <span className="cand-name">{c.name}</span>
          <MatchBadge strength={c.strength} />
          {fr && <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff', background: fr.color, borderRadius: '5px', padding: '1px 7px', whiteSpace: 'nowrap' }}>{fr.label}</span>}
          <span className="mono" style={{ fontSize: '11px', color: 'var(--ink-4)', whiteSpace: 'nowrap', marginLeft: 'auto' }}>applied {timeAgo(c.createdAt)}</span>
        </div>
        {(c.profile.current_title || lang) && (
          <div className="cand-role">{c.profile.current_title || '—'}{lang && <><span className="sep">·</span>{lang}</>}</div>
        )}
        {shown.length > 0 && (
          <div className="cand-skills">
            {shown.map((s, j) => <span key={j} className="tag">{tidySkill(s)}</span>)}
            {extra > 0 && <span className="meta" style={{ fontSize: '11px' }}>+{extra}</span>}
          </div>
        )}
        <div className="cand-facts">
          {typeof c.profile.rateFloorHourly === 'number' && c.profile.rateFloorHourly > 0 && <span className="fact"><RIcon name="bolt" size={14} /> <b>${c.profile.rateFloorHourly}/hr</b> from</span>}
          {c.profile.availabilityHours && <span className="fact"><RIcon name="clock" size={14} /> <b>{c.profile.availabilityHours}</b></span>}
          {c.profile.timezone && <span className="fact"><RIcon name="globe" size={14} /> {c.profile.timezone}</span>}
          {c.profile.location && <span className="fact"><RIcon name="pin" size={14} /> {c.profile.location}</span>}
          {typeof c.profile.experience_years === 'number' && c.profile.experience_years > 0 && <span className="fact"><RIcon name="briefcase" size={14} /> <b>{c.profile.experience_years} yrs</b></span>}
          {c.profile.availableFrom && <span className="fact"><RIcon name="cal" size={14} /> {c.profile.availableFrom}</span>}
        </div>
        {c.caveats && c.caveats.length > 0 && (
          <div className="caveat"><RIcon name="warn" size={14} /><span><b>Heads up:</b> {c.caveats[0]}</span></div>
        )}
      </div>
      <div className="cand-right" onClick={(e) => e.stopPropagation()}>
        <FitRing score={c.score} strength={c.strength} />
        <div className="cand-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => openDetail(c.appId)}><RIcon name="chat" size={13} /> Chat</button>
          {c.cvUrl && <a href={c.cvUrl} target="_blank" rel="noopener noreferrer" className="btn btn-soft btn-sm" onClick={() => track('view_cv', c.appId)}><RIcon name="doc" size={13} /> CV</a>}
          {revealed && email ? (
            <a href={`mailto:${email}`} className="lock-inline done" title="Email the candidate directly"><RIcon name="mail" size={13} /> {email}</a>
          ) : revealed ? (
            <span className="lock-inline done" onClick={() => openDetail(c.appId)}><RIcon name="unlock" size={13} /> Revealed</span>
          ) : (
            <button className="lock-inline" onClick={() => doReveal(c.appId)} disabled={revealing === c.appId}>
              <RIcon name="lock" size={13} /> {revealing === c.appId ? 'Revealing…' : 'Reveal'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Chat thread bubbles for a candidate (lazy-loaded). Used in detail + conversations.
export function ChatThread({ c }: { c: RecruiterCandidate }) {
  const { getThread, isThreadLoading } = useCabinet();
  const thread = getThread(c.appId);
  const firstName = c.name.split(' ')[0];
  if (isThreadLoading(c.appId) && thread.length === 0) {
    return <div className="meta" style={{ fontSize: '12px', textAlign: 'center', padding: '18px' }}>Loading conversation…</div>;
  }
  if (thread.length === 0) {
    return <div className="meta" style={{ fontSize: '12px', textAlign: 'center', padding: '18px' }}>No messages yet — say hello below.</div>;
  }
  return (
    <div className="chat-thread">
      {thread.map((m, j) => {
        if (m.from === 'system') return <div key={j} className="day-sep">{m.text}</div>;
        const mine = m.from === 'recruiter';
        return (
          <div key={j} className={`msg ${mine ? 'me' : 'them'}`}>
            <div>
              <div className="bubble">{m.text}</div>
              <div className="meta">{mine ? 'You' : firstName} · {shortTime(m.at)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Compose box — wired to cabinet send (gates registration at first reply).
export function Compose({ c, withSchedule = false }: { c: RecruiterCandidate; withSchedule?: boolean }) {
  const { draftOf, setDraft, doSend, sending, sendError } = useCabinet();
  const firstName = c.name.split(' ')[0];
  const err = sendError(c.appId);
  const draft = draftOf(c.appId);
  return (
    <div className="chat-compose">
      <textarea
        value={draft}
        onChange={(e) => setDraft(c.appId, e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); doSend(c.appId); } }}
        placeholder={`Reply to ${firstName}…  (⌘/Ctrl+Enter)`}
      />
      {withSchedule && <button className="btn btn-soft" title="Suggest a time"><RIcon name="cal" size={14} /></button>}
      <button className="btn btn-primary" onClick={() => doSend(c.appId)} disabled={sending === c.appId || !draft.trim()}>
        <RIcon name="send" size={14} /> {sending === c.appId ? 'Sending…' : 'Send'}
      </button>
      {err && <span className="meta" style={{ fontSize: '12px', color: '#c0392b', position: 'absolute', bottom: '-20px', left: '14px' }}>{err}</span>}
    </div>
  );
}

export function intentPill(c: RecruiterCandidate) {
  const intent = intentOf(c.status, c.repliedAt);
  return <span className={`intent-pill intent-${intent}`}>{intent}</span>;
}
