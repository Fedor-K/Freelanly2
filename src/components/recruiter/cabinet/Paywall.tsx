'use client';

import { useEffect, useState } from 'react';
import { RIcon } from './icons';
import { FREE_REVEAL_QUOTA } from './lib';

// Two free contact reveals → this modal. Mirrors the designer's paywall (value variant):
// left = headline + CTA, right = Free vs Pro feature comparison.
export function Paywall({ open, onClose, onSubscribe }: { open: boolean; onClose: () => void; onSubscribe: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) {
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    }
    setShow(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const free: [boolean, string][] = [
    [true, 'See candidate profiles & match'],
    [true, 'View skills, CV & cover letter'],
    [true, 'Chat with applicants'],
    [false, `${FREE_REVEAL_QUOTA} contact reveals total`],
    [false, 'No full-pool search'],
    [false, 'No job posting'],
  ];
  const pro: [boolean, string][] = [
    [true, 'Unlimited contact reveals'],
    [true, 'Direct email, instantly'],
    [true, 'Search the full candidate pool'],
    [true, 'Post your own roles'],
    [true, 'Priority match alerts'],
    [true, 'Export & ATS sync'],
  ];
  const feat = (rows: [boolean, string][]) =>
    rows.map(([yes, t], i) => (
      <li key={i} className={yes ? 'yes' : 'no'}>
        <RIcon name={yes ? 'check' : 'lock'} size={yes ? 14 : 13} />
        <span>{t}</span>
      </li>
    ));

  return (
    <>
      <div className={`pw-backdrop${show ? ' show' : ''}`} onClick={onClose} />
      <div className={`pw-modal pw-value${show ? ' show' : ''}`} role="dialog" aria-modal="true">
        <button className="pw-close" aria-label="Close" onClick={onClose}><RIcon name="x" size={18} /></button>
        <div className="pw-left">
          <div className="pw-eyebrow"><RIcon name="lock" size={13} /> Unlock unlimited</div>
          <h2 className="pw-title">Reach every candidate who applied to you</h2>
          <p className="pw-sub">
            You&rsquo;ve used all {FREE_REVEAL_QUOTA} free reveals. Go Pro to reveal direct contact for any
            candidate — plus search the whole pool and post your own roles.
          </p>
          <div className="pw-cta-row">
            <button className="btn btn-acid btn-lg" onClick={onSubscribe}><RIcon name="bolt" size={16} /> Subscribe — $49/mo</button>
            <button className="btn btn-ghost btn-lg" onClick={onClose}>Maybe later</button>
          </div>
          <div className="pw-trust mono">14-day money-back · Cancel anytime · ★★★★★ 4.9 from 1,200+ recruiters</div>
        </div>
        <div className="pw-right">
          <div className="pw-tiers">
            <div className="pw-tier">
              <div className="pw-tier-name">Free</div>
              <div className="pw-tier-price">$0<span>/mo</span></div>
              <ul className="pw-feat">{feat(free)}</ul>
            </div>
            <div className="pw-tier featured">
              <div className="pw-tier-flag">Recommended</div>
              <div className="pw-tier-name">Pro</div>
              <div className="pw-tier-price">$49<span>/mo</span></div>
              <ul className="pw-feat">{feat(pro)}</ul>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
