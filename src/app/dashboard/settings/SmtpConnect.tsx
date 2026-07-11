'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

// SMTP connect form: saves via /api/user/smtp then verifies via /api/user/smtp/test (which sets
// verified=true). Once verified, the user sends applications from their own address (any match, same 20/day cap), and
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
        <div style={{ fontSize: '12.5px', color: 'var(--ink-4, #8A8780)' }}>Sending from this address · any match, better replies</div>
      </div>
      <span className="chip chip-good" style={{ flexShrink: 0 }}><span className="chip-dot live"></span>Active</span>
      <button className="btn btn-soft btn-sm" style={{ flexShrink: 0 }} onClick={disconnect} disabled={busy}>{busy ? '…' : 'Disconnect'}</button>
    </div>
  );
}

// Shared SMTP form body — email / app-password / host / port + provider help + connect&verify.
// Used by the Settings integration card AND the in-feed "Connect my email" modal, so the exact
// same flow (save → /api/user/smtp/test → verified) runs everywhere. onConnected fires on success
// (before the reload) so a caller can react; onClose backs out.
export function SmtpConnectForm({ initialEmail, onClose, onConnected }: { initialEmail?: string; onClose?: () => void; onConnected?: () => void }) {
  const [email, setEmail] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(587);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err' | 'info'; text: string } | null>(null);
  // Guard: if an inbox is ALREADY connected (Gmail OAuth or verified SMTP), say so instead of
  // rendering the connect form — every surface that opens this form blindly (feed walls, project
  // walls) was re-sending connected users through Google consent in a loop.
  const [alreadyConnected, setAlreadyConnected] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/user/settings', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        const g = d?.integrations?.gmail;
        const s = d?.integrations?.smtp;
        if (g?.verified) setAlreadyConnected(g.email || 'your Gmail');
        else if (s?.verified) setAlreadyConnected(s.email || 'your email');
      })
      .catch(() => {});
  }, []);
  const [showManual, setShowManual] = useState(false); // app-password fallback, hidden behind the 1-click Google path

  // One-click Gmail OAuth (gmail.send) — the primary connect path. Full-page redirect; the callback
  // returns the user to where they started. Removes the app-password wall for the Gmail majority.
  const connectGmail = () => {
    // On a project page, come back with ?apply=1 so the application AUTO-RESUMES after connecting —
    // otherwise the user lands back on the page and has to click "Apply now" again (friction leak).
    // Elsewhere (Settings), just return to where they were.
    const path = typeof window !== 'undefined' ? window.location.pathname : '/dashboard/settings';
    const ret = path.startsWith('/freelance/') ? `${path}?apply=1` : path + window.location.search;
    window.location.href = '/api/user/gmail-oauth/start?return=' + encodeURIComponent(ret);
  };

  // Reflect the OAuth callback outcome (?gmail=connected|denied|error|unconfigured) back to the user.
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get('gmail');
    if (!g) return;
    if (g === 'connected') { setMsg({ type: 'ok', text: '✓ Gmail connected! Your applications now send from your own inbox.' }); onConnected?.(); }
    else if (g === 'denied') setMsg({ type: 'err', text: 'Google access was declined. Try again, or use an app password.' });
    else if (g === 'unconfigured') setMsg({ type: 'err', text: 'Google sign-in isn’t available right now — use an app password below.' });
    else setMsg({ type: 'err', text: 'Could not connect Gmail. Try again, or use an app password.' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        setMsg({ type: 'ok', text: '✓ Connected! Your applications now send from your own email — any match, better replies.' });
        onConnected?.();
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

  // Already connected → say so and stop. Re-showing the connect UI here is what looped users back
  // through Google's consent screen ("I connected — why is it asking again?").
  if (alreadyConnected) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', border: '1px solid var(--line, #E4E1D9)', borderRadius: '12px', background: 'var(--bg-2, #FBFAF6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>✓ Your email is already connected</div>
          {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '15px' }}>✕</button>}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--ink-3, #6B6862)', lineHeight: 1.55 }}>
          Applications send from <b>{alreadyConnected}</b> — nothing else to set up. Just write and send your application.
        </div>
        {onClose && <button className="btn btn-acid btn-sm" style={{ alignSelf: 'flex-start', background: '#C7F94A', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} onClick={onClose}>Got it</button>}
        <button onClick={() => setAlreadyConnected(null)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--ink-3, #8A8780)', textDecoration: 'underline', cursor: 'pointer', fontSize: '12.5px', padding: 0 }}>
          Connect a different email instead
        </button>
      </div>
    );
  }

  // 16px inputs, NOT 13px: iOS Safari auto-zooms the page when a focused input's font-size is <16px,
  // which blew the layout past the viewport (cut-off right edge) on phones.
  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line, #E4E1D9)', borderRadius: '8px', fontSize: '16px', background: '#fff', outline: 'none' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', border: '1px solid var(--line, #E4E1D9)', borderRadius: '12px', background: 'var(--bg-2, #FBFAF6)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>✉️ Connect your email to send</div>
        {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '15px' }}>✕</button>}
      </div>

      {/* PRIMARY: one-click Gmail (OAuth gmail.send) — no app password. */}
      <button onClick={connectGmail} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', width: '100%', padding: '12px', background: '#fff', color: '#1F1F1F', border: '1px solid #DADCE0', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
        Sign in with Google to send
      </button>
      <div style={{ fontSize: '12px', color: 'var(--ink-4, #8A8780)', lineHeight: 1.45 }}>
        Sends from your own Gmail — best delivery, any match. One click, no app password.
      </div>

      {/* SECONDARY: app-password fallback (other providers, or if you prefer manual SMTP) */}
      {!showManual ? (
        <button onClick={() => setShowManual(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--ink-3, #8A8780)', textDecoration: 'underline', cursor: 'pointer', fontSize: '12.5px', padding: 0 }}>
          Not Gmail? Connect with an app password instead
        </button>
      ) : (
      <>
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
      <button className="btn btn-acid btn-sm" style={{ alignSelf: 'flex-start', background: '#C7F94A', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }} onClick={connect} disabled={busy}>{busy ? 'Connecting…' : 'Connect & verify'}</button>
      </>
      )}
    </div>
  );
}

// Settings integration card — collapsed row that expands into the shared form in place.
export function SmtpConnect({ initialEmail }: { initialEmail?: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <div className="integration">
        <div className="ico" style={{ background: 'var(--bg-2)', color: 'var(--ink-3)', border: '1px solid var(--line)' }}>✉</div>
        <div>
          <div className="name">Email (SMTP)</div>
          <div className="meta">Send applications from your own address — any match, better replies</div>
        </div>
        <button className="btn btn-acid btn-sm" onClick={() => setOpen(true)}>Connect</button>
      </div>
    );
  }
  return <SmtpConnectForm initialEmail={initialEmail} onClose={() => setOpen(false)} />;
}

// Popup version — the "Connect my email" CTA on the feed / project page opens this instead of
// bouncing the user to Settings. Same form, in a centered overlay; click the backdrop or ✕ to close.
export function SmtpConnectModal({ open, onClose, initialEmail, onConnected }: { open: boolean; onClose: () => void; initialEmail?: string; onConnected?: () => void }) {
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    // PORTALED to <body>: iOS re-anchors position:fixed to transformed ancestors (modal floated
    // mid-scroll on phones). flex-start (not center): a centered modal ends up UNDER the software
    // keyboard on phones the moment an input focuses — top-aligned keeps the form visible.
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 2000, padding: '24px 16px 16px', overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '460px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <SmtpConnectForm initialEmail={initialEmail} onClose={onClose} onConnected={onConnected} />
      </div>
    </div>,
    document.body
  );
}
