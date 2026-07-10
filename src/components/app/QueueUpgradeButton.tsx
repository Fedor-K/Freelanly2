'use client';

import { useEffect, useState } from 'react';
import { useTracker } from '@/hooks/useTracker';

/** Teaser CTA → Stripe checkout for the $5 ready-queue plan. Tracks intent clicks (the WTP signal). */
export function QueueUpgradeButton({ source = 'queue_teaser', label = 'Unlock the queue →' }: { source?: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const { track } = useTracker();

  // Impression, once per mount. Without it, zero checkout clicks is unreadable — "offer rejected"
  // and "offer never seen" (teaser only renders when the queue is non-empty) look identical.
  useEffect(() => {
    track('FUNNEL_STEP', { step: 'pro5_teaser_shown', source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = async () => {
    setBusy(true);
    setErr('');
    track('FUNNEL_STEP', { step: 'pro5_checkout_click', source });
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey: 'pro5', source }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setErr(data.error || 'Could not start checkout — try again.');
    } catch {
      setErr('Network error — try again.');
    }
    setBusy(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
      <button className="btn btn-acid" onClick={go} disabled={busy}>
        {busy ? 'Opening checkout…' : label}
      </button>
      <span style={{ fontSize: '11.5px', color: 'var(--ink-4)' }}>$5/month · cancel anytime</span>
      {err && <span style={{ fontSize: '12px', color: '#B91C1C' }}>{err}</span>}
    </div>
  );
}
