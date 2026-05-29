'use client';

import { useState } from 'react';

// Passwordless recruiter sign-in: enter email -> we email the signed portal link.
// Response is intentionally generic (doesn't reveal whether the email is a known recruiter).
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
    } catch { /* ignore — show the same generic state */ }
    setState('sent'); // always generic, regardless of outcome
  }

  if (state === 'sent') {
    return (
      <div className="card" style={{ padding: '22px', textAlign: 'center' }}>
        <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '6px' }}>Check your email</div>
        <p className="meta" style={{ fontSize: '13px', lineHeight: 1.55, margin: 0 }}>
          If candidates have applied to your roles on Freelanly, we just emailed you a link to your inbox.
          Bookmark it — it’s your permanent access, no password needed.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '22px' }}>
      <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, margin: '0 0 6px' }}>Your email</label>
      <p className="meta" style={{ fontSize: '12.5px', margin: '0 0 12px' }}>
        The email recruiters use to receive applications. We’ll send a link to your candidate inbox.
      </p>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="you@company.com"
          style={{ flex: 1, minWidth: 0, padding: '11px 13px', border: '1px solid #E8E5DC', borderRadius: '9px', fontSize: '14px' }}
        />
        <button
          onClick={submit}
          disabled={state === 'sending' || !email.trim()}
          style={{ padding: '11px 20px', background: '#0B0C0F', color: '#fff', border: 0, borderRadius: '9px', fontSize: '14px', fontWeight: 600, cursor: state === 'sending' || !email.trim() ? 'default' : 'pointer', opacity: state === 'sending' || !email.trim() ? 0.5 : 1 }}
        >
          {state === 'sending' ? '…' : 'Send link'}
        </button>
      </div>
    </div>
  );
}
