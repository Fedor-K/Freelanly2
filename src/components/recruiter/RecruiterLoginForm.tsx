'use client';

import { useState } from 'react';

// Recruiter sign-in + registration in one (passwordless). Collects the profile up front
// (name/company, what they hire for, volume) — not hidden inside — and emails a link to the
// portal. Email is required; the rest is a quick optional profile so a returning recruiter can
// just type email + submit. Reuses the candidate auth design tokens (signup-design.css).
const VOLUMES = ['1', '2-5', '6-20', '20+'] as const;

export function RecruiterLoginForm() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [hiringFor, setHiringFor] = useState('');
  const [hiringVolume, setHiringVolume] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function submit() {
    if (state === 'sending' || !email.trim()) return;
    setState('sending');
    try {
      await fetch('/api/recruiter/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name, company, hiringFor, hiringVolume }),
      });
    } catch { /* ignore — same generic state */ }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <div style={{ background: '#fff', border: '1px solid rgba(11,12,15,0.12)', borderRadius: '14px', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ECFDF5', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
          </span>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>Check your email</span>
        </div>
        <p style={{ fontSize: '13.5px', color: '#5C6068', lineHeight: 1.55, margin: 0 }}>
          If candidates have applied to your roles, we just sent a link to your inbox.
          Bookmark it — it’s your permanent access, no password.
        </p>
      </div>
    );
  }

  return (
    <div className="field-group">
      <div>
        <label className="field-label">Your work email</label>
        <input
          type="email"
          className="text-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          autoFocus
        />
        <p className="helper">The address candidates’ applications arrive at.</p>
      </div>

      <div className="field-row-2">
        <div>
          <label className="field-label">Your name <span className="optional">(optional)</span></label>
          <input type="text" className="text-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane" />
        </div>
        <div>
          <label className="field-label">Company <span className="optional">(optional)</span></label>
          <input type="text" className="text-input" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme" />
        </div>
      </div>

      <div>
        <label className="field-label">What are you hiring for? <span className="optional">(optional)</span></label>
        <input type="text" className="text-input" value={hiringFor} onChange={(e) => setHiringFor(e.target.value)} placeholder="e.g. React developer, Interpreter" />
      </div>

      <div>
        <label className="field-label">How many to hire? <span className="optional">(optional)</span></label>
        <div className="cat-grid">
          {VOLUMES.map((v) => (
            <button
              key={v}
              type="button"
              className={`cat-chip${hiringVolume === v ? ' on' : ''}`}
              style={{ justifyContent: 'center' }}
              onClick={() => setHiringVolume(hiringVolume === v ? '' : v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <button className="primary-btn" onClick={submit} disabled={state === 'sending' || !email.trim()} style={{ marginTop: '6px' }}>
        {state === 'sending' ? 'Sending…' : 'Get my candidate inbox →'}
      </button>
    </div>
  );
}
