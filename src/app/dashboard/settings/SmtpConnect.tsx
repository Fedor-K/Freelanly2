'use client';

import { useState } from 'react';

// SMTP connect form: saves via /api/user/smtp then verifies via /api/user/smtp/test (which sets
// verified=true). Once verified, the user sends applications from their own address, unlimited, and
// any match (bypasses the Strong-only Postal gate). Auto-fills host/port from the email domain.
type Preset = { label: string; host: string; port: number; appPwUrl: string; twoFaUrl: string; steps: string[]; note?: string };

// One config per provider; many domains (incl. regional variants) map to each.
const PROVIDERS: Record<string, Preset> = {
  google: { label: 'Gmail', host: 'smtp.gmail.com', port: 587, appPwUrl: 'https://myaccount.google.com/apppasswords', twoFaUrl: 'https://myaccount.google.com/signinoptions/two-step-verification', steps: [
    'Turn on 2-Step Verification in your Google account (required — App Passwords only appear after this).',
    'Open the App Passwords page (button below), sign in, and create one named "Freelanly".',
    'Google shows a 16-character code like "abcd efgh ijkl mnop". Copy it and paste it above (spaces are fine).',
  ] },
  microsoft: { label: 'Outlook', host: 'smtp-mail.outlook.com', port: 587, appPwUrl: 'https://account.microsoft.com/security', twoFaUrl: 'https://account.microsoft.com/security', steps: [
    'Turn on two-step verification at account.microsoft.com → Security → Advanced security options.',
    'Create an app password (button below) and copy the code.',
    'Paste the code above.',
  ], note: 'Microsoft is phasing out app passwords for personal accounts — if it fails, the account may need OAuth (contact us).' },
  yahoo: { label: 'Yahoo', host: 'smtp.mail.yahoo.com', port: 587, appPwUrl: 'https://login.yahoo.com/account/security', twoFaUrl: 'https://login.yahoo.com/account/security', steps: [
    'Turn on 2-step verification at login.yahoo.com → Account Security.',
    'Generate an app password (button below) and copy it.',
    'Paste it above.',
  ] },
  icloud: { label: 'iCloud', host: 'smtp.mail.me.com', port: 587, appPwUrl: 'https://appleid.apple.com', twoFaUrl: 'https://appleid.apple.com', steps: [
    'Sign in at appleid.apple.com (2FA must be on).',
    'Under Sign-In & Security, create an app-specific password (button below).',
    'Copy it and paste it above.',
  ] },
  zoho: { label: 'Zoho', host: 'smtp.zoho.com', port: 587, appPwUrl: 'https://accounts.zoho.com/home#security/app_password', twoFaUrl: 'https://accounts.zoho.com/home#security/mfa', steps: [
    'Turn on Two-Factor Authentication at accounts.zoho.com → Security.',
    'Generate an Application-Specific Password (button below) and copy it.',
    'Paste it above.',
  ] },
  yandex: { label: 'Yandex', host: 'smtp.yandex.com', port: 587, appPwUrl: 'https://id.yandex.com/security/app-passwords', twoFaUrl: 'https://id.yandex.com/security', steps: [
    'Open Yandex ID → Security → App passwords (button below).',
    'Create an app password for "Mail" and copy it.',
    'Paste it above.',
  ] },
  mailru: { label: 'Mail.ru', host: 'smtp.mail.ru', port: 465, appPwUrl: 'https://account.mail.ru/user/2-step-auth/passwords/', twoFaUrl: 'https://account.mail.ru/user/2-step-auth/', steps: [
    'Enable 2-step verification in Mail.ru security settings.',
    'Create a password for an external app (button below) and copy it.',
    'Paste it above.',
  ] },
  gmx: { label: 'GMX', host: 'mail.gmx.com', port: 587, appPwUrl: 'https://www.gmx.com/', twoFaUrl: 'https://www.gmx.com/', steps: [
    'In GMX settings, enable POP3/IMAP access (Home → Settings → POP3/IMAP).',
    'Use your normal GMX password (or an app password if 2FA is on).',
    'Paste it above.',
  ] },
  proton: { label: 'Proton', host: '127.0.0.1', port: 1025, appPwUrl: 'https://proton.me/mail/bridge', twoFaUrl: 'https://proton.me/mail/bridge', steps: [
    'Proton only allows SMTP through Proton Mail Bridge (a paid-plan desktop app).',
    'Install Bridge (link below); it gives you a local SMTP host, port and password.',
    'Enter those here. Without Bridge, Proton cannot send via SMTP — use another address.',
  ], note: 'Proton requires the paid Mail Bridge for SMTP.' },
};

// Domain → provider, covering the regional variants our users actually have.
const DOMAIN_TO_PROVIDER: Record<string, keyof typeof PROVIDERS> = {
  'gmail.com': 'google', 'googlemail.com': 'google',
  'outlook.com': 'microsoft', 'hotmail.com': 'microsoft', 'live.com': 'microsoft', 'msn.com': 'microsoft',
  'outlook.es': 'microsoft', 'hotmail.es': 'microsoft', 'live.com.ar': 'microsoft', 'hotmail.com.ar': 'microsoft',
  'outlook.com.br': 'microsoft', 'hotmail.com.br': 'microsoft', 'live.com.mx': 'microsoft', 'hotmail.com.mx': 'microsoft', 'outlook.com.ar': 'microsoft',
  'yahoo.com': 'yahoo', 'yahoo.com.mx': 'yahoo', 'yahoo.es': 'yahoo', 'yahoo.com.ar': 'yahoo', 'yahoo.com.br': 'yahoo', 'ymail.com': 'yahoo', 'rocketmail.com': 'yahoo',
  'icloud.com': 'icloud', 'me.com': 'icloud', 'mac.com': 'icloud',
  'zoho.com': 'zoho', 'zohomail.com': 'zoho',
  'yandex.com': 'yandex', 'yandex.ru': 'yandex', 'ya.ru': 'yandex',
  'mail.ru': 'mailru', 'bk.ru': 'mailru', 'inbox.ru': 'mailru', 'list.ru': 'mailru', 'internet.ru': 'mailru',
  'gmx.com': 'gmx', 'gmx.net': 'gmx', 'gmx.de': 'gmx',
  'protonmail.com': 'proton', 'proton.me': 'proton', 'pm.me': 'proton',
};

const PRESETS = new Proxy({} as Record<string, Preset | undefined>, {
  get: (_t, domain: string) => {
    const key = DOMAIN_TO_PROVIDER[domain];
    return key ? PROVIDERS[key] : undefined;
  },
});

export function SmtpConnected({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  async function disconnect() {
    if (!confirm('Disconnect your email? Good/Weak matches will need it reconnected to send from your address.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/user/smtp', { method: 'DELETE' });
      if (res.ok) window.location.reload();
      else setBusy(false);
    } catch { setBusy(false); }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: '1px solid var(--line, #E4E1D9)', borderRadius: '12px', background: 'var(--bg-2, #FBFAF6)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EA4335', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 700, flexShrink: 0 }}>G</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>SMTP · {email}</div>
        <div style={{ fontSize: '12.5px', color: 'var(--ink-4, #8A8780)' }}>Sending from this address · unlimited</div>
      </div>
      <span className="chip chip-good" style={{ flexShrink: 0 }}><span className="chip-dot live"></span>Active</span>
      <button className="btn btn-soft btn-sm" style={{ flexShrink: 0 }} onClick={disconnect} disabled={busy}>{busy ? '…' : 'Disconnect'}</button>
    </div>
  );
}

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

    // Gmail App Passwords are exactly 16 chars (shown as "abcd efgh ijkl mnop"). Catch the #1 failure —
    // a normal password — BEFORE we round-trip to Gmail and eat a 535 reject. Strip the display spaces.
    const provider = DOMAIN_TO_PROVIDER[domain];
    let pw = password.trim();
    if (provider === 'google') {
      pw = pw.replace(/\s+/g, '');
      if (pw.length !== 16) {
        setMsg({ type: 'err', text: 'That doesn’t look like a Gmail App Password. Gmail needs a 16-character code (like "abcd efgh ijkl mnop") you generate after turning on 2-Step Verification — not your normal password. Create one with the button below and paste it here.' });
        return;
      }
    }

    setBusy(true);
    setMsg({ type: 'info', text: 'Saving and testing your connection…' });
    try {
      const save = await fetch('/api/user/smtp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: effHost, port: effPort, email, password: pw }),
      });
      if (!save.ok) { const d = await save.json().catch(() => ({})); setMsg({ type: 'err', text: d.error || 'Could not save SMTP settings.' }); setBusy(false); return; }
      const test = await fetch('/api/user/smtp/test', { method: 'POST' });
      const td = await test.json().catch(() => ({}));
      if (test.ok && td.success !== false) {
        setMsg({ type: 'ok', text: '✓ Connected! You can now send from your own email, unlimited.' });
        setTimeout(() => window.location.reload(), 1200);
      } else {
        const raw = String(td.error || '');
        const badCreds = /BadCredentials|535|Username and Password not accepted|5\.7\.8/i.test(raw);
        setMsg({
          type: 'err',
          text: badCreds
            ? `That password didn't work — Gmail/Outlook reject your normal password here. You need an App Password (a 16-character code you generate after turning on 2-Step Verification). Paste that instead.`
            : (raw || 'Saved, but the test send failed — check your host, port, and app password.'),
        });
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

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line, #E4E1D9)', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', border: '1px solid var(--line, #E4E1D9)', borderRadius: '12px', background: 'var(--bg-2, #FBFAF6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>✉️ Connect your email (SMTP)</div>
        <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '15px' }}>✕</button>
      </div>
      <input style={inputStyle} type="email" placeholder="you@gmail.com" value={email} onChange={e => { setEmail(e.target.value); setHost(''); }} />
      <input style={inputStyle} type="password" placeholder="App password (not your normal password)" value={password} onChange={e => setPassword(e.target.value)} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <input style={{ ...inputStyle, flex: 2 }} placeholder="SMTP host" value={effHost} onChange={e => setHost(e.target.value)} />
        <input style={{ ...inputStyle, flex: 1, minWidth: 0 }} type="number" placeholder="Port" value={effPort} onChange={e => setPort(Number(e.target.value) || 587)} />
      </div>

      {/* Step-by-step: where to get the app password for the detected provider */}
      {preset ? (
        <div style={{ background: '#FFF9E8', border: '1px solid #F5E6B8', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#7A5E00', marginBottom: '8px' }}>
            {preset.label} needs an <strong>App Password</strong> — not your normal password. Here&apos;s how:
          </div>
          <ol style={{ margin: '0 0 10px', paddingLeft: '18px', fontSize: '12.5px', color: '#6B5A1E', lineHeight: 1.6 }}>
            {preset.steps.map((s, i) => <li key={i} style={{ marginBottom: '3px' }}>{s}</li>)}
          </ol>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <a href={preset.appPwUrl} target="_blank" rel="noopener noreferrer" className="btn btn-soft btn-sm">Open {preset.label} App Passwords ↗</a>
            <a href={preset.twoFaUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#7A5E00', alignSelf: 'center', textDecoration: 'underline' }}>Page says &ldquo;not available&rdquo;? Turn on 2-Step first ↗</a>
          </div>
          {preset.note && <div style={{ fontSize: '11.5px', color: '#9A6B00', marginTop: '8px', fontStyle: 'italic' }}>⚠ {preset.note}</div>}
        </div>
      ) : domain ? (
        <div style={{ fontSize: '12px', color: 'var(--ink-4, #8A8780)' }}>Use your provider&apos;s SMTP host and an app password (most providers require one instead of your normal password).</div>
      ) : null}

      {msg && <div style={{ fontSize: '12.5px', color: msg.type === 'ok' ? 'var(--good, #2E7D32)' : msg.type === 'err' ? 'var(--bad, #B91C1C)' : 'var(--ink-3, #8A8780)', lineHeight: 1.5 }}>{msg.text}</div>}
      <button className="btn btn-acid btn-sm" style={{ alignSelf: 'flex-start' }} onClick={connect} disabled={busy}>{busy ? 'Connecting…' : 'Connect & verify'}</button>
    </div>
  );
}
