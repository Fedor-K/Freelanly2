'use client';

import { useState } from 'react';

// SMTP connect form: saves via /api/user/smtp then verifies via /api/user/smtp/test (which sets
// verified=true). Once verified, the user sends applications from their own address, unlimited, and
// any match (bypasses the Strong-only Postal gate). Auto-fills host/port from the email domain.
const PRESETS: Record<string, { host: string; port: number; help: string }> = {
  'gmail.com': { host: 'smtp.gmail.com', port: 587, help: 'Gmail needs an App Password (not your normal password): myaccount.google.com → Security → 2-Step Verification → App passwords.' },
  'outlook.com': { host: 'smtp-mail.outlook.com', port: 587, help: 'Outlook/Hotmail: create an app password at account.microsoft.com → Security.' },
  'hotmail.com': { host: 'smtp-mail.outlook.com', port: 587, help: 'Outlook/Hotmail: create an app password at account.microsoft.com → Security.' },
  'yahoo.com': { host: 'smtp.mail.yahoo.com', port: 587, help: 'Yahoo: generate an app password at login.yahoo.com → Account security.' },
  'icloud.com': { host: 'smtp.mail.me.com', port: 587, help: 'iCloud: create an app-specific password at appleid.apple.com.' },
};

export function SmtpConnect({ initialEmail }: { initialEmail?: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);

  const domain = email.split('@')[1]?.toLowerCase() || '';
  const preset = PRESETS[domain];
  const effHost = host || preset?.host || '';
  const effPort = port || preset?.port || 587;

  async function connect() {
    if (!email || !password || !effHost) { setMsg({ type: 'err', text: 'Fill in your email, app password, and SMTP host.' }); return; }
    setBusy(true);
    setMsg({ type: 'info', text: 'Saving and testing your connection…' });
    try {
      const save = await fetch('/api/user/smtp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: effHost, port: effPort, email, password }),
      });
      if (!save.ok) { const d = await save.json().catch(() => ({})); setMsg({ type: 'err', text: d.error || 'Could not save SMTP settings.' }); setBusy(false); return; }
      const test = await fetch('/api/user/smtp/test', { method: 'POST' });
      const td = await test.json().catch(() => ({}));
      if (test.ok && td.success !== false) {
        setMsg({ type: 'ok', text: '✓ Connected! You can now send from your own email, unlimited.' });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setMsg({ type: 'err', text: td.error || 'Saved, but the test send failed — check your app password and host.' });
      }
    } catch {
      setMsg({ type: 'err', text: 'Network error — try again.' });
    }
    setBusy(false);
  }

  if (!open) {
    return (
      <div className="integration">
        <div className="ico" style={{ background: 'var(--bg-2)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}>✉</div>
        <div>
          <div className="name">Email (SMTP)</div>
          <div className="meta">Send applications from your own address — unlimited, any match</div>
        </div>
        <button className="btn btn-acid btn-sm" onClick={() => setOpen(true)}>Connect</button>
      </div>
    );
  }

  return (
    <div className="integration" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="name">Connect your email (SMTP)</div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '13px' }}>✕</button>
      </div>
      <input className="field" type="email" placeholder="you@gmail.com" value={email} onChange={e => { setEmail(e.target.value); setHost(''); }} />
      <input className="field" type="password" placeholder="App password" value={password} onChange={e => setPassword(e.target.value)} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <input className="field" style={{ flex: 2 }} placeholder="SMTP host" value={effHost} onChange={e => setHost(e.target.value)} />
        <input className="field" style={{ flex: 1 }} type="number" placeholder="Port" value={effPort} onChange={e => setPort(Number(e.target.value) || 587)} />
      </div>
      {preset && <div style={{ fontSize: '12px', color: 'var(--ink-4)', lineHeight: 1.5 }}>{preset.help}</div>}
      {!preset && domain && <div style={{ fontSize: '12px', color: 'var(--ink-4)' }}>Use your provider&apos;s SMTP host and an app password.</div>}
      {msg && <div style={{ fontSize: '12.5px', color: msg.type === 'ok' ? 'var(--good)' : msg.type === 'err' ? 'var(--bad)' : 'var(--ink-3)' }}>{msg.text}</div>}
      <button className="btn btn-acid btn-sm" onClick={connect} disabled={busy}>{busy ? 'Connecting…' : 'Connect & verify'}</button>
    </div>
  );
}
