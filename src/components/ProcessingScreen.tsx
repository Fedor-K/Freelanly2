'use client';

import { useState, useEffect } from 'react';

export type ProcStep = { title: string; sub: string };

/**
 * Reusable "work in progress" screen: spinning ring + pulsing emoji, status lines that rotate so
 * a 10-35s wait reads as live work (not a freeze), and a striped progress bar that fills per step.
 * Used by both signup forms during the profile build (résumé upload + LinkedIn scrape + AI parse).
 */
export function ProcessingScreen({ steps, emoji = '⚙️', note = 'This usually takes a few seconds…' }: { steps: ProcStep[]; emoji?: string; note?: string }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => Math.min(i + 1, steps.length - 1)), 2600);
    return () => clearInterval(id);
  }, [steps.length]);

  const step = steps[idx] || steps[0];
  const pct = Math.round(((idx + 1) / steps.length) * 100);

  return (
    <div style={{ textAlign: 'center', padding: '20px 0' }}>
      <style>{`
        @keyframes ps-spin { to { transform: rotate(360deg); } }
        @keyframes ps-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .55; transform: scale(.9); } }
        @keyframes ps-bar { from { background-position: 0 0; } to { background-position: 28px 0; } }
      `}</style>
      <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 18px' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #ECEAE3', borderTopColor: '#C7F94A', animation: 'ps-spin .9s linear infinite' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, animation: 'ps-pulse 1.6s ease-in-out infinite' }}>{emoji}</div>
      </div>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '6px' }}>{step.title}</h2>
      <p style={{ fontSize: '13px', color: '#8A8780', marginBottom: '16px', minHeight: 18 }}>{step.sub}</p>
      <div style={{ width: '72%', maxWidth: 260, height: 6, margin: '0 auto', background: '#ECEAE3', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 999, transition: 'width .6s ease', backgroundImage: 'repeating-linear-gradient(45deg, #C7F94A 0, #C7F94A 8px, #b6e842 8px, #b6e842 16px)', backgroundSize: '28px 28px', animation: 'ps-bar 1s linear infinite' }} />
      </div>
      <p style={{ fontSize: '11px', color: '#B3AFA6', marginTop: 10 }}>{note}</p>
    </div>
  );
}

// Shared step copy for the profile build (used by both signup forms).
export const PROFILE_BUILD_STEPS: ProcStep[] = [
  { title: 'Uploading your résumé…', sub: 'Securely storing your PDF' },
  { title: 'Reading your LinkedIn…', sub: 'Pulling your experience & skills' },
  { title: 'Building your profile…', sub: 'Matching you to live gigs' },
  { title: 'Almost ready…', sub: 'Final touches' },
];
