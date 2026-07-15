'use client';

import { useEffect, useRef, useState } from 'react';
import { useTracker } from '@/hooks/useTracker';

// REAL lander now (was a fake-door until 2026-07-15): the Lever autofill extension exists.
// Distribution is a .zip + load-unpacked until the Chrome Web Store listing is approved.
export default function AutofillBetaClient({ opp }: { opp: string | null }) {
  const { track } = useTracker();
  const viewLogged = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [tokenErr, setTokenErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (viewLogged.current) return;
    viewLogged.current = true;
    track('FUNNEL_STEP', { step: 'autofill_beta_view', opportunityId: opp || undefined });
    // Same-origin, session-authed — shows the user's connect token right on the page.
    fetch('/api/extension/token')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setToken(d.token))
      .catch((s) => setTokenErr(s === 401 ? 'login' : 'error'));
  }, [track, opp]);

  const step = (n: number, title: string, body: React.ReactNode) => (
    <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
      <div style={{ flexShrink: 0, width: '24px', height: '24px', borderRadius: '50%', background: '#1a1a17', color: '#fff', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>
      <div style={{ fontSize: '14px', lineHeight: 1.55, color: '#333' }}>
        <b>{title}</b>
        <div style={{ color: '#555', marginTop: '2px' }}>{body}</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#fafaf8' }}>
      <div style={{ maxWidth: '560px', width: '100%', background: '#fff', border: '1px solid #e5e5e0', borderRadius: '16px', padding: '40px 36px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a7d00', background: '#eaf7c0', borderRadius: '999px', padding: '4px 10px', marginBottom: '16px' }}>
          Beta — live now · free
        </div>
        <h1 style={{ fontSize: '26px', lineHeight: 1.2, margin: '0 0 12px', color: '#111' }}>
          Apply to company sites in 1 click
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.55, color: '#555', margin: '0 0 20px' }}>
          Freelanly Autofill fills job application forms on company career sites (Lever for now) from
          your Freelanly profile — name, links, résumé PDF, even AI-drafted answers to custom
          questions. You review everything and hit submit yourself.
        </p>

        {step(1, 'Download the extension', (
          <a
            href="/downloads/freelanly-autofill.zip"
            onClick={() => track('FUNNEL_STEP', { step: 'autofill_download_click', opportunityId: opp || undefined })}
            style={{ display: 'inline-block', marginTop: '6px', fontSize: '15px', fontWeight: 700, color: '#111', background: '#d4f24b', borderRadius: '10px', padding: '10px 18px', textDecoration: 'none' }}
          >
            ⬇ Download freelanly-autofill.zip
          </a>
        ))}
        {step(2, 'Install it (30 seconds)', (
          <>Unzip → open <code style={{ background: '#f4f4f0', padding: '1px 5px', borderRadius: '4px' }}>chrome://extensions</code> → turn on <b>Developer mode</b> (top right) → <b>Load unpacked</b> → pick the <code style={{ background: '#f4f4f0', padding: '1px 5px', borderRadius: '4px' }}>lever-autofill</code> folder. (Chrome Web Store listing is on the way — this is the beta path.)</>
        ))}
        {step(3, 'Connect it', (
          token ? (
            <span>
              Click the extension icon and paste your token:{' '}
              <code style={{ background: '#f4f4f0', padding: '3px 7px', borderRadius: '6px', fontSize: '12px', wordBreak: 'break-all' }}>{token}</code>{' '}
              <button
                onClick={() => { navigator.clipboard.writeText(token); setCopied(true); track('FUNNEL_STEP', { step: 'autofill_token_copied', opportunityId: opp || undefined }); }}
                style={{ fontSize: '12px', fontWeight: 700, border: '1px solid #ddd', background: copied ? '#eaf7c0' : '#fff', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer' }}
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </span>
          ) : tokenErr === 'login' ? (
            <span><a href="/auth/signin?callbackUrl=/autofill" style={{ color: '#2563eb' }}>Log in</a> to get your connect token.</span>
          ) : (
            <span style={{ color: '#999' }}>Loading your token…</span>
          )
        ))}
        {step(4, 'Use it', (
          <>Open any Lever job page (from your feed or anywhere) and hit <b>⚡ Autofill with Freelanly</b>. Green = filled, orange = needs you. Review, then submit.</>
        ))}

        {opp && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <a href={`/go/ats/${opp}`} style={{ fontSize: '14px', color: '#777', textDecoration: 'underline' }}>
              Or continue to the company site and apply manually ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
