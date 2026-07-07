'use client';

import { useState, useEffect } from 'react';
import { trackEvent } from '@/hooks/useTracker';

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
  // Step-by-step wizard: one action per screen. 'email' detects the provider, then app-password
  // providers get a 2FA step + an app-password step before the paste step; unknown providers skip
  // straight to a manual paste (email/password/host/port).
  const [step, setStep] = useState<'email' | '2fa' | 'apppw' | 'code'>('email');
  const [advanced, setAdvanced] = useState(false);

  const domain = email.split('@')[1]?.toLowerCase() || '';
  const preset = PRESETS[domain];
  const provider = DOMAIN_TO_PROVIDER[domain];
  const effHost = host || preset?.host || '';
  const effPort = port || preset?.port || 587;

  // Per-step funnel: log each wizard screen the user reaches, so the drop-off (2FA vs app-password vs
  // paste) is measurable. Fires on mount ('email') and every step change. Verified/fail logged in connect().
  useEffect(() => { trackEvent('FUNNEL_STEP', { step: `smtp_wizard_${step}`, provider: provider || 'other' }); }, [step, provider]);

  async function connect() {
    if (!email || !password || !effHost) { setMsg({ type: 'err', text: 'Fill in your email, app password, and SMTP host.' }); return; }

    // Gmail App Passwords are exactly 16 chars (shown as "abcd efgh ijkl mnop"). Catch the #1 failure —
    // a normal password — BEFORE we round-trip to Gmail and eat a 535 reject. Strip the display spaces.
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
        trackEvent('FUNNEL_STEP', { step: 'smtp_wizard_verified', provider: provider || 'other' });
        setMsg({ type: 'ok', text: '✓ Connected! You can now send from your own email, unlimited.' });
        onConnected?.();
        setTimeout(() => window.location.reload(), 1200);
      } else {
        const raw = String(td.error || '');
        const badCreds = /BadCredentials|535|Username and Password not accepted|5\.7\.8/i.test(raw);
        trackEvent('FUNNEL_STEP', { step: 'smtp_wizard_verify_fail', provider: provider || 'other', badCreds });
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

  const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line, #E4E1D9)', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none' };
  const primaryBtn: React.CSSProperties = { background: '#C7F94A', color: '#000', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' };
  const ghostBtn: React.CSSProperties = { background: 'transparent', color: 'var(--ink-3, #8A8780)', border: '1px solid var(--line, #E4E1D9)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', cursor: 'pointer' };

  // Ordered steps depend on the provider: app-password providers get the 2FA + app-password screens.
  const stepList: Array<typeof step> = preset ? ['email', '2fa', 'apppw', 'code'] : ['email', 'code'];
  const stepNum = Math.max(0, stepList.indexOf(step)) + 1;
  const gpw = password.replace(/\s+/g, '');
  const googleShort = provider === 'google' && gpw.length > 0 && gpw.length !== 16;

  function goFromEmail() {
    const d = email.split('@')[1]?.toLowerCase();
    if (!email || !email.includes('@') || !d) { setMsg({ type: 'err', text: 'Enter a valid email address.' }); return; }
    setMsg(null);
    setStep(PRESETS[d] ? '2fa' : 'code');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', border: '1px solid var(--line, #E4E1D9)', borderRadius: '12px', background: 'var(--bg-2, #FBFAF6)' }}>
      {/* Header: progress + close */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ink-4, #8A8780)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Connect email · Step {stepNum} of {stepList.length}</div>
        {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--ink-3)', cursor: 'pointer', fontSize: '15px' }}>✕</button>}
      </div>
      {/* Progress bar */}
      <div style={{ height: 4, borderRadius: 999, background: 'var(--line, #E4E1D9)', overflow: 'hidden' }}>
        <div style={{ width: `${(stepNum / stepList.length) * 100}%`, height: '100%', background: '#C7F94A', transition: 'width .3s ease' }} />
      </div>

      {/* STEP 1 — email + trust */}
      {step === 'email' && (
        <>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Send from your own email</div>
          <div style={{ fontSize: '12.5px', color: 'var(--ink-4, #8A8780)', lineHeight: 1.5 }}>
            Apply from your own address — unlimited, and your applications land better. We only use it to <b>send</b> your applications; we never read your inbox.
          </div>
          <input style={inputStyle} type="email" placeholder="you@gmail.com" value={email} onChange={e => { setEmail(e.target.value); setHost(''); }} onKeyDown={e => { if (e.key === 'Enter') goFromEmail(); }} autoFocus />
          {msg && <div style={{ fontSize: '12.5px', color: msg.type === 'err' ? 'var(--bad, #B91C1C)' : 'var(--ink-3, #8A8780)' }}>{msg.text}</div>}
          <button style={primaryBtn} onClick={goFromEmail}>Continue →</button>
        </>
      )}

      {/* STEP 2 — turn on 2FA (app-password providers) */}
      {step === '2fa' && preset && (
        <>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Turn on 2-Step Verification</div>
          <div style={{ fontSize: '12.5px', color: 'var(--ink-4, #8A8780)', lineHeight: 1.5 }}>
            {preset.label} only lets you create an app password once 2-Step Verification is on. Open the page, turn it on, then come back. Already on? Skip.
          </div>
          <a href={preset.twoFaUrl} target="_blank" rel="noopener noreferrer" style={{ ...primaryBtn, display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>Open {preset.label} 2-Step page ↗</a>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
            <button style={ghostBtn} onClick={() => setStep('email')}>← Back</button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={ghostBtn} onClick={() => setStep('apppw')}>Already on — skip</button>
              <button style={primaryBtn} onClick={() => setStep('apppw')}>Done → Next</button>
            </div>
          </div>
        </>
      )}

      {/* STEP 3 — create the app password */}
      {step === 'apppw' && preset && (
        <>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Create an app password</div>
          <div style={{ fontSize: '12.5px', color: 'var(--ink-4, #8A8780)', lineHeight: 1.5 }}>
            {preset.label} needs a one-time <b>app password</b> (not your normal password). Open the page and create one named &ldquo;Freelanly&rdquo;:
          </div>
          <ol style={{ margin: 0, paddingLeft: '18px', fontSize: '12.5px', color: 'var(--ink-3, #6B5A1E)', lineHeight: 1.6 }}>
            {preset.steps.map((s, i) => <li key={i} style={{ marginBottom: '3px' }}>{s}</li>)}
          </ol>
          <a href={preset.appPwUrl} target="_blank" rel="noopener noreferrer" style={{ ...primaryBtn, display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>Open {preset.label} app-passwords ↗</a>
          {preset.note && <div style={{ fontSize: '11.5px', color: '#9A6B00', fontStyle: 'italic' }}>⚠ {preset.note}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
            <button style={ghostBtn} onClick={() => setStep('2fa')}>← Back</button>
            <button style={primaryBtn} onClick={() => setStep('code')}>I&apos;ve copied the code →</button>
          </div>
        </>
      )}

      {/* STEP 4 — paste code + verify (also the manual step for unknown providers) */}
      {step === 'code' && (
        <>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>{preset ? 'Paste your app password' : 'Enter your SMTP details'}</div>
          <div style={{ fontSize: '12.5px', color: 'var(--ink-4, #8A8780)', lineHeight: 1.5 }}>
            {preset ? `Paste the ${preset.label} app password you just copied.` : 'Enter your email password (or app password) and your provider’s SMTP host.'}
          </div>
          <input style={inputStyle} type="password" placeholder={preset ? 'App password (16 characters)' : 'Password / app password'} value={password} onChange={e => setPassword(e.target.value)} autoFocus />
          {provider === 'google' && password.length > 0 && (
            <div style={{ fontSize: '11.5px', color: googleShort ? 'var(--bad, #B91C1C)' : 'var(--good, #2E7D32)' }}>{gpw.length}/16 characters{googleShort ? ' — a Gmail app password is exactly 16' : ' ✓'}</div>
          )}
          {(!preset || advanced) && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input style={{ ...inputStyle, flex: 2 }} placeholder="SMTP host" value={effHost} onChange={e => setHost(e.target.value)} />
              <input style={{ ...inputStyle, flex: 1, minWidth: 0 }} type="number" placeholder="Port" value={effPort} onChange={e => setPort(Number(e.target.value) || 587)} />
            </div>
          )}
          {preset && !advanced && <button onClick={() => setAdvanced(true)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--ink-4, #8A8780)', fontSize: '11.5px', textDecoration: 'underline', cursor: 'pointer', padding: 0 }}>Advanced: set host / port</button>}
          {msg && <div style={{ fontSize: '12.5px', color: msg.type === 'ok' ? 'var(--good, #2E7D32)' : msg.type === 'err' ? 'var(--bad, #B91C1C)' : 'var(--ink-3, #8A8780)', lineHeight: 1.5 }}>{msg.text}</div>}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
            <button style={ghostBtn} onClick={() => setStep(preset ? 'apppw' : 'email')} disabled={busy}>← Back</button>
            <button style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }} onClick={connect} disabled={busy}>{busy ? 'Verifying…' : 'Connect & verify'}</button>
          </div>
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
          <div className="meta">Send applications from your own address — unlimited, any match</div>
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
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '460px', maxHeight: '92vh', overflowY: 'auto', borderRadius: '14px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <SmtpConnectForm initialEmail={initialEmail} onClose={onClose} onConnected={onConnected} />
      </div>
    </div>
  );
}
