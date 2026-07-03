'use client';

import { useEffect, useRef, useState } from 'react';
import { useTracker } from '@/hooks/useTracker';

export default function AutofillBetaClient({ opp }: { opp: string | null }) {
  const { track } = useTracker();
  const viewLogged = useRef(false);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (viewLogged.current) return;
    viewLogged.current = true;
    track('FUNNEL_STEP', { step: 'autofill_beta_view', opportunityId: opp || undefined });
  }, [track, opp]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#fafaf8' }}>
      <div style={{ maxWidth: '520px', width: '100%', background: '#fff', border: '1px solid #e5e5e0', borderRadius: '16px', padding: '40px 36px', boxShadow: '0 2px 16px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'inline-block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5a7d00', background: '#eaf7c0', borderRadius: '999px', padding: '4px 10px', marginBottom: '16px' }}>
          Beta — coming soon
        </div>
        <h1 style={{ fontSize: '26px', lineHeight: 1.2, margin: '0 0 12px', color: '#111' }}>
          Apply to company sites in 1 click
        </h1>
        <p style={{ fontSize: '15px', lineHeight: 1.55, color: '#555', margin: '0 0 20px' }}>
          Freelanly Autofill is a Chrome extension that fills job application forms on company career
          sites (Lever first) with your Freelanly profile — you just review and hit submit. No more
          typing the same 20 fields for every role.
        </p>
        <ul style={{ fontSize: '14px', lineHeight: 1.7, color: '#444', margin: '0 0 24px', paddingLeft: '20px' }}>
          <li>Name, email, LinkedIn and your résumé PDF — filled automatically</li>
          <li>AI-drafted answers for custom questions, you approve before submitting</li>
          <li>Works on roles from your feed and anywhere else on the web</li>
        </ul>
        {joined ? (
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#3a7d00', background: '#f2fadd', border: '1px solid #d8eeaa', borderRadius: '10px', padding: '14px 16px', textAlign: 'center' }}>
            ✓ You&apos;re on the list — we&apos;ll email you when it&apos;s live
          </div>
        ) : (
          <button
            onClick={() => {
              track('FUNNEL_STEP', { step: 'autofill_beta_signup', opportunityId: opp || undefined });
              setJoined(true);
            }}
            style={{ width: '100%', fontSize: '16px', fontWeight: 700, color: '#111', background: '#d4f24b', border: 'none', borderRadius: '10px', padding: '14px 16px', cursor: 'pointer' }}
          >
            Get early access
          </button>
        )}
        {opp && (
          <div style={{ marginTop: '18px', textAlign: 'center' }}>
            <a href={`/go/ats/${opp}`} style={{ fontSize: '14px', color: '#777', textDecoration: 'underline' }}>
              Or continue to the company site and apply manually ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
