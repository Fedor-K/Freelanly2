'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripeClient } from '@/lib/stripe-client';
import { useTracker } from '@/hooks/useTracker';

const stripePromise = getStripeClient();

function btn(primary: boolean): CSSProperties {
  return primary
    ? { background: '#84cc16', color: '#1a2e05', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' }
    : { background: 'transparent', color: '#8a8f98', border: 'none', padding: '10px', fontSize: 13, cursor: 'pointer', width: '100%' };
}

/**
 * Optional "save a card now" step shown right after registration (hybrid model). Saving it makes the
 * first $3 pack one-tap at the wall; Skip is always available so registration completion isn't gated on
 * a card. Uses a SetupIntent (no charge). Both Skip and Save call onDone() to proceed to the feed.
 */
export function OnboardingCardStep({ onDone }: { onDone: () => void }) {
  const { track } = useTracker();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    track('FUNNEL_STEP', { step: 'onboarding_card_shown' });
    fetch('/api/stripe/setup-intent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (d?.clientSecret) setClientSecret(d.clientSecret); else onDone(); })
      .catch(() => { setLoadFailed(true); onDone(); }); // flag off / error → transparently skip
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loadFailed) return null; // onDone already fired the redirect

  return (
    <div style={{ padding: '8px 4px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>💳</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Save a card for one-tap applies</div>
      <div style={{ fontSize: 13, color: '#5C6068', marginBottom: 16, lineHeight: 1.5 }}>
        Nothing is charged now. Your first application is free — after that, sending 6 more is one tap ($3).
      </div>
      {clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <SetupForm onDone={onDone} track={track} />
        </Elements>
      ) : (
        <div style={{ fontSize: 13, color: '#8a8f98', padding: '20px' }}>Loading…</div>
      )}
    </div>
  );
}

function SetupForm({ onDone, track }: { onDone: () => void; track: (a: 'FUNNEL_STEP', d: Record<string, unknown>) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    if (!stripe || !elements) return;
    setBusy(true); setError('');
    track('FUNNEL_STEP', { step: 'onboarding_card_save_click' });
    const { error: err } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
    if (err) { setError(err.message || 'Could not save card'); setBusy(false); return; }
    track('FUNNEL_STEP', { step: 'onboarding_card_saved' });
    onDone(); // card saved (persisted by the setup_intent.succeeded webhook) → proceed
  }

  return (
    <div>
      <div style={{ textAlign: 'left', marginBottom: 14 }}><PaymentElement /></div>
      {error && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 10 }}>{error}</div>}
      <button onClick={save} disabled={busy || !stripe} style={btn(true)}>{busy ? 'Saving…' : 'Save card & continue'}</button>
      <button onClick={onDone} disabled={busy} style={btn(false)}>Skip for now</button>
    </div>
  );
}
