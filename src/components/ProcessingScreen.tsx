'use client';

import { useState, useEffect } from 'react';

export type ProcStep = { title: string; sub: string };

/**
 * Reusable "work in progress" screen: spinning ring + pulsing emoji, status lines that rotate so
 * a 10-35s wait reads as live work (not a freeze), and a striped progress bar that fills per step.
 * Used by both signup forms during the profile build (résumé upload + LinkedIn scrape + AI parse).
 */
const SCAN_COLORS = ['#FF6B6B', '#A8E024', '#6EE7FF', '#FFB951'];

export function ProcessingScreen({ steps, emoji = '⚙️', note = 'This usually takes a few seconds…', scan = false }: { steps: ProcStep[]; emoji?: string; note?: string; scan?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [scanned, setScanned] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => Math.min(i + 1, steps.length - 1)), 2600);
    return () => clearInterval(id);
  }, [steps.length]);
  // Live "scanning posts" counter (scan mode only) — climbs fast then eases over the pool.
  useEffect(() => {
    if (!scan) return;
    const id = setInterval(() => setScanned(n => (n >= 2480 ? n : n + Math.max(7, Math.round((2500 - n) * 0.06)))), 110);
    return () => clearInterval(id);
  }, [scan]);

  const step = steps[idx] || steps[0];
  const pct = Math.round(((idx + 1) / steps.length) * 100);

  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <style>{`
        @keyframes ps-bar { from { background-position: 0 0; } to { background-position: 28px 0; } }
        @keyframes ps-spin { to { transform: rotate(360deg); } }
        @keyframes ps-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .55; transform: scale(.9); } }
        @keyframes ps-row { 0%,100% { border-color:#ECEAE3; background:#fff; } 18% { border-color:#C7F94A; background:#F4FBE6; } }
        @keyframes ps-check { 0%,12% { opacity:0; transform:scale(.5); } 24%,100% { opacity:1; transform:scale(1); } }
        @keyframes ps-beam { 0% { top:-10%; } 100% { top:110%; } }
      `}</style>

      {scan ? (
        <>
          {/* "Scanning the feed" — mini post cards lit one-by-one by a sweeping beam, like the matcher reading posts. */}
          <div style={{ position: 'relative', width: '78%', maxWidth: 280, margin: '0 auto 16px', display: 'flex', flexDirection: 'column', gap: 7, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: 0, right: 0, height: '34%', top: '-10%', background: 'linear-gradient(180deg, transparent, rgba(199,249,74,.28), transparent)', animation: 'ps-beam 1.8s linear infinite', pointerEvents: 'none', zIndex: 2 }} />
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 9, border: '1px solid #ECEAE3', background: '#fff', animation: `ps-row 1.8s ease-in-out ${i * 0.42}s infinite` }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', flex: '0 0 auto', background: SCAN_COLORS[i % SCAN_COLORS.length] }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ height: 6, width: `${70 - i * 8}%`, borderRadius: 3, background: '#E3E0D8' }} />
                  <div style={{ height: 5, width: `${45 + i * 6}%`, borderRadius: 3, background: '#EFEDE6' }} />
                </div>
                <div style={{ fontSize: 13, flex: '0 0 auto', color: '#4D8B0A', animation: `ps-check 1.8s ease-in-out ${i * 0.42}s infinite` }}>✓</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#8A8780', marginBottom: 10, fontFamily: "'Geist Mono', monospace" }}>
            {emoji} Scanning <span style={{ color: '#0A0B0F', fontWeight: 600 }}>{scanned.toLocaleString('en-US')}</span> live posts…
          </div>
        </>
      ) : (
        <div style={{ position: 'relative', width: 56, height: 56, margin: '0 auto 18px' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '3px solid #ECEAE3', borderTopColor: '#C7F94A', animation: 'ps-spin .9s linear infinite' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, animation: 'ps-pulse 1.6s ease-in-out infinite' }}>{emoji}</div>
        </div>
      )}

      <h2 style={{ fontSize: '17px', fontWeight: 600, marginBottom: '6px' }}>{step.title}</h2>
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
