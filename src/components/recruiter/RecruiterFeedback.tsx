'use client';

import { useEffect, useState } from 'react';

// One-tap, in-portal satisfaction question. Veiled willingness-to-pay probe: whoever taps
// "direct contact" is signalling the thing we'd monetize — without ever mentioning money.
// Mirrors the user-side survey format ("tap one"). Shows once per browser.
const OPTIONS = [
  { value: 'Direct contact details', label: '📇  Candidates’ direct contact (email/phone)' },
  { value: 'Better matches', label: '🎯  Better-matched candidates' },
  { value: 'More candidates', label: '➕  More candidates' },
  { value: 'Post my own jobs', label: '📢  Post my own job openings' },
  { value: "Already great", label: '✅  It’s already great' },
];

export function RecruiterFeedback({ token }: { token: string }) {
  const [hidden, setHidden] = useState(true); // hidden until we confirm it wasn't answered
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem('rfb_v1')) return; // already answered/dismissed
    } catch { /* ignore */ }
    setHidden(false);
  }, []);

  function pick(answer: string) {
    fetch('/api/recruiter/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, question: 'wishlist', answer }),
    }).catch(() => {});
    try { localStorage.setItem('rfb_v1', '1'); } catch { /* ignore */ }
    setDone(true);
  }

  if (hidden) return null;

  if (done) {
    return (
      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', textAlign: 'center' }}>
        <span className="meta" style={{ fontSize: '13px' }}>Thanks — that helps us build the right thing. 🙌</span>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 600 }}>What would make Freelanly more useful for you?</span>
        <button
          onClick={() => { try { localStorage.setItem('rfb_v1', '1'); } catch {} setDone(true); }}
          className="meta"
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px' }}
          aria-label="Dismiss"
        >Skip</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => pick(o.value)}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
