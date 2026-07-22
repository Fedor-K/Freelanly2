'use client';

import { useState, type CSSProperties } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripeClient } from '@/lib/stripe-client';
import { QueueUpgradeButton } from './QueueUpgradeButton';
import { useTracker } from '@/hooks/useTracker';

const stripePromise = getStripeClient();

function btnStyle(busy: boolean): CSSProperties {
  return {
    background: busy ? '#cfe8b8' : '#84cc16', color: '#1a2e05', border: 'none', borderRadius: 10,
    padding: '12px 20px', fontWeight: 700, fontSize: 14, cursor: busy ? 'default' : 'pointer', width: '100%',
  };
}

// Balance top-up options (AI-service model, owner decision 2026-07-22): the user tops up a BALANCE
// (min $3) and applies draw from it at $0.50 each — not "buying a pack". Server whitelists the amounts.
const TOPUPS = [
  { cents: 300, label: '$3' },
  { cents: 500, label: '$5' },
  { cents: 1000, label: '$10' },
];

/**
 * Balance top-up wall (inline, no redirect). Dropped INTO the existing wall render blocks (feed draft
 * modal / project review), replacing the old "$5/mo redirect" CTA when the 402 says offer:'credits'.
 * On success it grants the balance synchronously (confirm endpoint) then calls onCreditsReady() to
 * RETRY the same apply, which draws $0.50 from the balance and sends.
 */
export function ApplyPaywallModal({
  message, source, onCreditsReady,
}: {
  message?: string; packSize?: number; packPriceCents?: number; source: string; onCreditsReady: () => void;
}) {
  const { track } = useTracker();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');
  const [amountCents, setAmountCents] = useState(300);
  const applies = amountCents / 50;
  const priceLabel = `$${(amountCents / 100).toFixed(amountCents % 100 ? 2 : 0)}`;

  async function grantAndRetry(paymentIntentId: string) {
    // Grant credits server-side BEFORE the retry so consumeApplyCredit finds a balance (idempotent with
    // the webhook). Then retry the apply.
    await fetch('/api/stripe/charge-credits/confirm', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentIntentId }),
    }).catch(() => {});
    track('FUNNEL_STEP', { step: 'credit_charge_success', source });
    onCreditsReady();
  }

  async function start() {
    setBusy(true); setError('');
    track('FUNNEL_STEP', { step: 'credit_charge_click', source, amountCents });
    try {
      const res = await fetch('/api/stripe/charge-credits', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amountCents }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) { setError(data.error || 'Could not start payment'); setBusy(false); return; }
      setClientSecret(data.clientSecret);
      if (data.hasCard) {
        // One-tap: the saved card is attached to the intent — confirm it (handles 3DS natively).
        const stripe = await stripePromise;
        if (!stripe) { setError('Payment unavailable'); setBusy(false); return; }
        const { error: err, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret);
        if (err) { setError(err.message || 'Payment failed'); setBusy(false); return; }
        if (paymentIntent?.status === 'succeeded') { await grantAndRetry(paymentIntent.id); }
        else { setError('Payment not completed'); setBusy(false); }
      } else {
        setShowCardForm(true); // mount Elements to collect a card
        setBusy(false);
      }
    } catch { setError('Network error — try again'); setBusy(false); }
  }

  return (
    <div style={{ padding: '28px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 10 }}>✨</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{message || 'Your free application is used'}</div>
      <div style={{ fontSize: 13, color: '#5C6068', marginBottom: 14, lineHeight: 1.5 }}>
        Top up your balance and keep applying — <b>$0.50 per application</b>. No subscription, balance never expires.
      </div>

      {error && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!showCardForm ? (
        <>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
            {TOPUPS.map((t) => (
              <button key={t.cents} onClick={() => setAmountCents(t.cents)} disabled={busy}
                style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 13,
                  border: amountCents === t.cents ? '2px solid #84cc16' : '1px solid #d7dae0',
                  background: amountCents === t.cents ? '#f4fce8' : '#fff', fontWeight: 700, color: '#1a2e05',
                }}>
                {t.label}
                <div style={{ fontSize: 11, fontWeight: 400, color: '#8a8f98' }}>{t.cents / 50} applies</div>
              </button>
            ))}
          </div>
          <button onClick={start} disabled={busy} style={btnStyle(busy)}>
            {busy ? 'Processing…' : `Top up ${priceLabel} →`}
          </button>
        </>
      ) : clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <CardForm priceLabel={priceLabel} packSize={applies} clientSecret={clientSecret}
            onSucceeded={grantAndRetry} onError={setError} />
        </Elements>
      ) : null}

      <div style={{ marginTop: 18, borderTop: '1px solid #eee', paddingTop: 14 }}>
        <div style={{ fontSize: 12, color: '#8a8f98', marginBottom: 8 }}>or apply as much as you want</div>
        <QueueUpgradeButton source="application_paywall_modal_5mo" label="Go unlimited — $5/mo →" />
      </div>
    </div>
  );
}

function CardForm({
  priceLabel, packSize, clientSecret, onSucceeded, onError,
}: {
  priceLabel: string; packSize: number; clientSecret: string;
  onSucceeded: (paymentIntentId: string) => Promise<void>; onError: (m: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true); onError('');
    const { error, paymentIntent } = await stripe.confirmPayment({ elements, clientSecret, redirect: 'if_required' });
    if (error) { onError(error.message || 'Payment failed'); setBusy(false); return; }
    if (paymentIntent?.status === 'succeeded') { await onSucceeded(paymentIntent.id); }
    else { onError('Payment not completed'); setBusy(false); }
  }

  return (
    <div>
      <div style={{ textAlign: 'left', marginBottom: 14 }}><PaymentElement /></div>
      <button onClick={pay} disabled={busy || !stripe} style={btnStyle(busy)}>
        {busy ? 'Processing…' : `Top up ${priceLabel} (${packSize} applications)`}
      </button>
    </div>
  );
}
