'use client';

import { useState, type CSSProperties } from 'react';

const input: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1px solid #E8E5DC', borderRadius: 9, fontSize: 14, marginBottom: 10 };
const button: CSSProperties = { width: '100%', padding: 12, background: '#C7F94A', color: '#000', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' };

export function RecruiterLoginForm() {
  const [phase, setPhase] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function sendCode() {
    if (!email.trim()) return;
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/recruiter/send-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (r.ok) setPhase('code');
      else setErr((await r.json().catch(() => ({}))).error || 'Something went wrong');
    } catch { setErr('Network error'); } finally { setLoading(false); }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code.trim())) { setErr('Enter the 6-digit code'); return; }
    setLoading(true); setErr('');
    try {
      const r = await fetch('/api/recruiter/verify-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      if (r.ok) {
        window.location.href = '/recruiter'; // session cookie set → redirects into the portal
      } else {
        setErr((await r.json().catch(() => ({}))).error || 'Incorrect code');
      }
    } catch { setErr('Network error'); } finally { setLoading(false); }
  }

  if (phase === 'code') {
    return (
      <div>
        <p style={{ fontSize: 13, color: '#555', margin: '0 0 12px' }}>
          We sent a 6-digit code to <strong>{email}</strong>.
        </p>
        <input
          style={{ ...input, letterSpacing: 4, fontSize: 18, textAlign: 'center' }}
          inputMode="numeric" maxLength={6} placeholder="••••••"
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && verify()} autoFocus
        />
        {err && <div style={{ fontSize: 12.5, color: '#B91C1C', marginBottom: 10 }}>{err}</div>}
        <button style={button} onClick={verify} disabled={loading}>{loading ? 'Verifying…' : 'Open my candidates →'}</button>
        <button
          onClick={() => { setPhase('email'); setCode(''); setErr(''); }}
          style={{ width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#8A8780', fontSize: 12.5, cursor: 'pointer' }}
        >← Use a different email</button>
      </div>
    );
  }

  return (
    <div>
      <input
        style={input} type="email" placeholder="you@company.com" autoFocus
        value={email} onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendCode()}
      />
      {err && <div style={{ fontSize: 12.5, color: '#B91C1C', marginBottom: 10 }}>{err}</div>}
      <button style={button} onClick={sendCode} disabled={loading}>{loading ? 'Sending…' : 'Send me a code'}</button>
    </div>
  );
}
