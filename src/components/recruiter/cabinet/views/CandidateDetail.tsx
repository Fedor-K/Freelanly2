'use client';

import { useEffect } from 'react';
import { RIcon } from '../icons';
import { useCabinet } from '../RecruiterCabinet';
import { ChatThread, Compose, MatchBadge, intentPill } from '../parts';
import { avColor, initials, tidySkill, timeAgo } from '../lib';

export function CandidateDetail({ appId }: { appId: string }) {
  const cab = useCabinet();
  const { candidates, colorIdx, closeDetail, loadThread, isRevealed, revealedEmail, revealing, doReveal, isPro, revealsLeft, track } = cab;
  const c = candidates.find((x) => x.appId === appId);

  useEffect(() => { if (appId) loadThread(appId); }, [appId, loadThread]);

  if (!c) {
    return <div className="card card-pad"><p className="meta">Candidate not found.</p></div>;
  }

  const i = colorIdx[c.appId] ?? 0;
  const revealed = isRevealed(c.appId);
  const email = revealedEmail(c.appId);
  const lines = c.matchBreakdown?.lines || [];
  const matched = lines.filter((l) => l.status === 'full');
  const missing = lines.filter((l) => l.status === 'missing');
  const skills = c.profile.skills || [];

  return (
    <>
      <a href="#" className="row gap-2 muted mb-4" style={{ fontSize: '13px', width: 'fit-content' }} onClick={(e) => { e.preventDefault(); closeDetail(); }}>
        <span style={{ transform: 'rotate(180deg)', display: 'inline-flex' }}><RIcon name="arrow" size={14} /></span>Back to candidates
      </a>

      <div className="detail-grid">
        {/* LEFT */}
        <div className="col gap-4">
          {/* hero */}
          <div className="card card-pad-lg">
            <div className="profile-hero">
              <div className="profile-av" style={{ background: avColor(i) }}>{initials(c.name)}</div>
              <div>
                <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                  <h1 style={{ fontSize: '24px', fontWeight: 500, letterSpacing: '-0.02em', margin: 0, whiteSpace: 'nowrap' }}>{c.name}</h1>
                  <MatchBadge strength={c.strength} />
                </div>
                <div className="muted mt-2" style={{ fontSize: '14px' }}>
                  {c.profile.current_title || c.jobTitle}
                  {c.profile.location && <><span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>{c.profile.location}</>}
                  <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>applied {timeAgo(c.createdAt)} to <b style={{ color: 'var(--ink-2)', fontWeight: 500 }}>{c.jobTitle}</b>
                </div>
              </div>
            </div>
            <div className="row gap-2 mt-6" style={{ flexWrap: 'wrap' }}>
              {c.cvUrl && <a className="btn btn-ghost" href={c.cvUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('view_cv', c.appId)}><RIcon name="doc" size={14} /> View CV</a>}
              {c.profile.portfolioUrl && <a className="btn btn-ghost" href={c.profile.portfolioUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('view_portfolio', c.appId)}><RIcon name="link" size={14} /> Portfolio</a>}
            </div>
            {c.caveats && c.caveats.length > 0 && (
              <div className="caveat mt-4"><RIcon name="warn" size={15} /><span><b>Honest caveat:</b> {c.caveats[0]}</span></div>
            )}
          </div>

          {/* at a glance */}
          <div className="card card-pad">
            <div className="section-head"><h2>At a glance</h2>{typeof c.profile.experience_years === 'number' && c.profile.experience_years > 0 && <span className="meta mono">{c.profile.experience_years} yrs experience</span>}</div>
            <div className="spec-grid mt-3">
              {typeof c.profile.rateFloorHourly === 'number' && c.profile.rateFloorHourly > 0 && <div className="spec"><div className="k">Rate from</div><div className="v">${c.profile.rateFloorHourly}<small>/hr</small></div></div>}
              {c.profile.salaryExpectation && <div className="spec"><div className="k">Wants (stated)</div><div className="v">{c.profile.salaryExpectation}</div></div>}
              {c.profile.availabilityHours && <div className="spec"><div className="k">Availability</div><div className="v">{c.profile.availabilityHours}</div></div>}
              {c.profile.availableFrom && <div className="spec"><div className="k">Can start</div><div className="v">{c.profile.availableFrom}</div></div>}
              {c.profile.timezone && <div className="spec"><div className="k">Timezone</div><div className="v">{c.profile.timezone}</div></div>}
              {c.profile.location && <div className="spec"><div className="k">Location</div><div className="v">{c.profile.location}</div></div>}
              {c.profile.languages && c.profile.languages.length > 0 && <div className="spec" style={{ gridColumn: '1 / -1' }}><div className="k">Languages</div><div className="v">{c.profile.languages.join(' · ')}</div></div>}
            </div>
          </div>

          {/* skills */}
          {skills.length > 0 && (
            <div className="card card-pad">
              <div className="section-head"><h2>Skills</h2></div>
              <div className="row" style={{ flexWrap: 'wrap', gap: '8px' }}>
                {skills.map((s, j) => <span key={j} className={`tag ${j < 3 ? 'tag-acid' : ''}`} style={{ fontSize: '13px', padding: '5px 11px' }}>{tidySkill(s)}</span>)}
              </div>
            </div>
          )}

          {/* match breakdown */}
          {lines.length > 0 && (
            <div className="card card-pad">
              <div className="section-head">
                <h2>Match breakdown</h2>
                <span className="meta mono">{matched.length} matched · {missing.length} gap{missing.length === 1 ? '' : 's'}</span>
              </div>
              <div className="breakdown mt-2">
                {matched.map((m, j) => (
                  <div key={`m${j}`} className="bd-row"><div className="bd-ico yes"><RIcon name="check" size={12} /></div><div className="req">{m.label}</div><div className="note">{m.evidence ? 'matched' : 'matched'}</div></div>
                ))}
                {missing.map((m, j) => (
                  <div key={`x${j}`} className="bd-row miss"><div className="bd-ico no"><RIcon name="x" size={12} /></div><div className="req">{m.label}</div><div className="note">not in profile</div></div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div className="col gap-4">
          {/* contact lock */}
          <div className={`contact-lock${revealed ? ' revealed' : ''}`}>
            <div className="cl-head">
              <div className="cl-lockico"><RIcon name={revealed ? 'unlock' : 'lock'} size={17} /></div>
              <div>
                <div className="cl-title">Direct contact</div>
                <div className="cl-sub">{revealed ? 'Reach out any time' : 'Email — reach out instantly'}</div>
              </div>
            </div>
            <div className="cl-body">
              {revealed && email ? (
                <div className="contact-slot" style={{ marginBottom: '14px' }}>
                  <a className="contact-line" href={`mailto:${email}`}><RIcon name="mail" size={15} /> <span className="mono">{email}</span></a>
                </div>
              ) : (
                <div className="cl-fields">
                  <div className="cl-field"><span className="lbl">Email</span><span className="masked">candidate.contact@example.com</span><RIcon name="lock" size={14} /></div>
                </div>
              )}
              {!revealed && (
                <div className="cl-cta">
                  <button className="btn btn-acid btn-lg" onClick={() => doReveal(c.appId)} disabled={revealing === c.appId}>
                    <RIcon name="unlock" size={16} /> {revealing === c.appId ? 'Revealing…' : 'Reveal contact'}
                  </button>
                  <span className="cl-quota">{isPro ? <><b>Pro</b> · unlimited reveals</> : <><b>{revealsLeft} of 2</b> free reveals left</>}</span>
                </div>
              )}
            </div>
          </div>

          {/* conversation */}
          <div className="card">
            <div className="card-head">
              <h3>Conversation</h3>
              {intentPill(c)}
            </div>
            <div className="card-pad" style={{ paddingBottom: '8px' }}>
              <ChatThread c={c} />
            </div>
            <Compose c={c} />
          </div>

          {/* cover note */}
          {c.coverLetter && (
            <div className="card card-pad">
              <div className="section-head"><h2>Cover note</h2></div>
              <p className="muted" style={{ fontSize: '13.5px', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{c.coverLetter}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
