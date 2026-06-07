'use client';

import { RIcon } from '../icons';
import { useCabinet } from '../RecruiterCabinet';
import { FREE_REVEAL_QUOTA } from '../lib';

export function AccountView() {
  const { recruiter, isPro, revealsUsed, revealsLeft, openPaywall } = useCabinet();
  const left = isPro ? Infinity : (revealsLeft as number);

  const freeFeats: [boolean, string][] = [
    [true, 'See candidate profiles & match strength'],
    [true, 'Skills, CV, portfolio & cover letter'],
    [true, 'Chat with applicants'],
    [false, `${FREE_REVEAL_QUOTA} contact reveals total`],
    [false, 'No full-pool search'],
    [false, 'No job posting'],
  ];
  const proFeats: [boolean, string][] = [
    [true, 'Unlimited contact reveals'],
    [true, 'Direct email, instantly'],
    [true, 'Search the full candidate pool'],
    [true, 'Post your own roles'],
    [true, 'Priority match alerts'],
    [true, 'Export & ATS sync'],
  ];
  const li = ([yes, t]: [boolean, string], i: number) => (
    <li key={i} className={yes ? 'yes' : 'no'}><RIcon name={yes ? 'check' : 'lock'} size={yes ? 15 : 13} /><span>{t}</span></li>
  );

  return (
    <>
      <div className="page-header">
        <div className="page-title"><h1>Account &amp; plan</h1><p>Manage your subscription, usage, and billing.</p></div>
      </div>

      {/* current plan / usage */}
      <div className="card card-pad-lg mb-4">
        {isPro ? (
          <div className="between" style={{ flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <div className="row gap-2 mb-2"><span className="match-badge match-strong"><span className="dot" />Pro</span><span className="eyebrow">active</span></div>
              <div style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.02em' }}>Unlimited contact reveals</div>
              <div className="muted mt-2" style={{ fontSize: '13.5px' }}>Full-pool search and job posting are unlocked.</div>
            </div>
            <div className="col" style={{ alignItems: 'flex-end', gap: '8px' }}>
              <div className="kpi-value" style={{ fontSize: '32px' }}>$49<span className="unit">/mo</span></div>
            </div>
          </div>
        ) : (
          <div className="between" style={{ flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <div className="row gap-2 mb-2"><span className="chip">Free plan</span></div>
              <div style={{ fontSize: '20px', fontWeight: 500, letterSpacing: '-0.02em' }}>You&rsquo;ve used {revealsUsed} of {FREE_REVEAL_QUOTA} contact reveals</div>
              <div className={`usage-meter mt-3${left <= 0 ? ' full' : ''}`} style={{ maxWidth: '320px' }}><div style={{ width: `${(revealsUsed / FREE_REVEAL_QUOTA) * 100}%` }} /></div>
              <div className="muted mt-2" style={{ fontSize: '13px' }}>{left > 0 ? `${left} free ${left === 1 ? 'reveal' : 'reveals'} remaining.` : "You're out of free reveals."} Upgrade for unlimited contacts, full-pool search and job posting.</div>
            </div>
            <button className="btn btn-acid btn-lg" onClick={openPaywall}><RIcon name="bolt" size={16} /> Upgrade to Pro</button>
          </div>
        )}
      </div>

      {/* tiers */}
      <div className="section-head mt-2"><h2>Plans</h2><span className="meta mono">billed monthly · cancel anytime</span></div>
      <div className="tiers mb-6">
        <div className="tier">
          <div className="tier-name">Free</div>
          <div className="tier-price">$0<span>/mo</span></div>
          <ul className="tier-list">{freeFeats.map(li)}</ul>
          <button className="btn btn-soft" style={{ width: '100%' }} disabled={!isPro}>{isPro ? 'Switch to Free' : 'Current plan'}</button>
        </div>
        <div className="tier featured">
          <div className="tier-flag">Recommended</div>
          <div className="tier-name">Pro</div>
          <div className="tier-price">$49<span>/mo</span></div>
          <ul className="tier-list">{proFeats.map(li)}</ul>
          {isPro
            ? <button className="btn btn-soft" style={{ width: '100%' }}>✓ Current plan</button>
            : <button className="btn btn-acid" style={{ width: '100%' }} onClick={openPaywall}><RIcon name="bolt" size={15} /> Upgrade to Pro</button>}
        </div>
      </div>

      {/* account row */}
      <div className="card card-pad mt-4" style={{ background: 'var(--bg-2)' }}>
        <div className="between" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '13.5px', fontWeight: 500 }}>Account</div>
            <div className="mono" style={{ fontSize: '11.5px', color: 'var(--ink-4)' }}>{recruiter.email}{recruiter.company ? ` · ${recruiter.company}` : ''}</div>
          </div>
        </div>
      </div>
    </>
  );
}
