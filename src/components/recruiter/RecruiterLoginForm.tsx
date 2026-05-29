'use client';

import { useState } from 'react';

// Passwordless recruiter sign-in. Reuses the candidate auth design tokens (signup-design.css:
// field-label / text-input / primary-btn). Response is generic — never reveals whether the
// email is a known recruiter.
export function RecruiterLoginForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');

  async function submit() {
    if (state === 'sending' || !email.trim()) return;
    setState('sending');
    try {
      await fetch('/api/recruiter/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
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
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="you@company.com"
          autoFocus
        />
        <p className="helper">The address candidates’ applications arrive at.</p>
      </div>
      <button className="primary-btn" onClick={submit} disabled={state === 'sending' || !email.trim()} style={{ marginTop: 0 }}>
        {state === 'sending' ? 'Sending…' : 'Email me my inbox link →'}
      </button>
    </div>
  );
}
