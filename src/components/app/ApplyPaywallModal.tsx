'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { getStripeClient, STRIPE_BLOCKED_MSG } from '@/lib/stripe-client';
import { QueueUpgradeButton } from './QueueUpgradeButton';
import { useTracker } from '@/hooks/useTracker';

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
  message, source, onCreditsReady, queueCount, variant,
}: {
  message?: string; packSize?: number; packPriceCents?: number; source: string; onCreditsReady: () => void;
  /** A/B (experiment wall_queue_offer_v1): variant 'B' + a non-thin queue shows the "N ready matches"
   *  offer instead of the generic top-up copy. Gated at >=5 so we never over-promise a thin profile. */
  queueCount?: number; variant?: 'A' | 'B';
}) {
  const { track } = useTracker();
  const router = useRouter();
  const showQueueOffer = variant === 'B' && (queueCount ?? 0) >= 5;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showCardForm, setShowCardForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>('');
  const [amountCents, setAmountCents] = useState(300);
  const [recoveryActive, setRecoveryActive] = useState(false);
  const priceLabel = `$${(amountCents / 100).toFixed(amountCents % 100 ? 2 : 0)}`;

  // Does this user hold an unused one-time 50%-off grant from the chat win-back? If so we surface a
  // $1.50 first-pack. Fetched once; never blocks the normal flow.
  useEffect(() => {
    let alive = true;
    fetch('/api/user/recovery-status').then((r) => r.json()).then((d) => { if (alive && d?.active) setRecoveryActive(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function grantAndRetry(paymentIntentId: string) {
    // Grant credits server-side BEFORE the retry so consumeApplyCredit finds a balance (idempotent with
    // the webhook). Then retry the apply.
    await fetch('/api/stripe/charge-credits/confirm', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentIntentId }),
    }).catch(() => {});
    track('FUNNEL_STEP', { step: 'credit_charge_success', source, variant, queueCount });
    // Re-render server components (sidebar balance widget, etc.) so the new balance shows without a
    // manual page reload. Client state (feed, open modals) is preserved by router.refresh().
    router.refresh();
    onCreditsReady();
  }

  async function start(useRecovery = false) {
    setBusy(true); setError('');
    track('FUNNEL_STEP', { step: 'credit_charge_click', source, amountCents: useRecovery ? 150 : amountCents, recovery: useRecovery, variant, queueCount });
    try {
      const res = await fetch('/api/stripe/charge-credits', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(useRecovery ? { recovery: true } : { amountCents }),
      });
      const data = await res.json();
      if (!res.ok || !data.clientSecret) { setError(data.error || 'Could not start payment'); setBusy(false); return; }
      // Echo the server-decided amount so the card-form price label is correct (recovery = $1.50).
      if (typeof data.amountCents === 'number') setAmountCents(data.amountCents);
      setClientSecret(data.clientSecret);
      if (data.hasCard) {
        // One-tap: the saved card is attached to the intent — confirm it (handles 3DS natively).
        const stripe = await getStripeClient();
        if (!stripe) { setError(STRIPE_BLOCKED_MSG); setBusy(false); return; }
        const { error: err, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret);
        if (err) { setError(err.message || 'Payment failed'); setBusy(false); return; }
        if (paymentIntent?.status === 'succeeded') { await grantAndRetry(paymentIntent.id); }
        else { setError('Payment not completed'); setBusy(false); }
      } else {
        // Pre-flight the (lazy) Stripe.js load BEFORE mounting Elements: with an ad-blocker the
        // script never loads and the form would hang on "Loading…" forever — tell them why instead.
        const stripe = await getStripeClient();
        if (!stripe) { setError(STRIPE_BLOCKED_MSG); setBusy(false); return; }
        setShowCardForm(true); // mount Elements to collect a card
        setBusy(false);
      }
    } catch { setError('Network error — try again'); setBusy(false); }
  }

  return (
    <div style={{ padding: '28px 24px', textAlign: 'center' }}>
      {showQueueOffer ? (
        <>
          <div style={{ fontSize: 24, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
            We prepared <span style={{ color: '#4a7c0f' }}>{queueCount} applications</span> matched to your profile
          </div>
          <div style={{ fontSize: 13, color: '#5C6068', marginBottom: 14, lineHeight: 1.5 }}>
            Fresh matched roles — with letters written for you — every morning. Sent straight to the poster, not a form.
            Unlock to send them all — <b>$0.50 each</b>. No subscription, balance never expires.
          </div>
        </>
      ) : (
        <>
          <div style={{ fontSize: 24, marginBottom: 10 }}>✨</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{message || 'Your free application is used'}</div>
          <div style={{ fontSize: 13, color: '#5C6068', marginBottom: 14, lineHeight: 1.5 }}>
            Top up your balance and keep applying — <b>$0.50 per application</b>. No subscription, balance never expires.
          </div>
        </>
      )}

      {error && <div style={{ color: '#c0392b', fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {!showCardForm ? (
        <>
          {recoveryActive && (
            <button onClick={() => start(true)} disabled={busy}
              style={{ width: '100%', marginBottom: 12, padding: '12px 14px', borderRadius: 10, border: '2px solid #84cc16', background: '#f4fce8', color: '#1a2e05', fontWeight: 800, fontSize: 13.5, cursor: busy ? 'default' : 'pointer', lineHeight: 1.4 }}>
              🎉 Claim your 50% off — first pack $1.50{' '}
              <span style={{ textDecoration: 'line-through', color: '#8a8f98', fontWeight: 600 }}>$3</span>{' '}
              <span style={{ fontWeight: 600, color: '#5C6068' }}>(6 applications)</span>
            </button>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 12 }}>
            {TOPUPS.map((t) => (
              <button key={t.cents} onClick={() => setAmountCents(t.cents)} disabled={busy}
                style={{
                  flex: 1, padding: '10px 6px', borderRadius: 10, cursor: 'pointer', fontSize: 13,
                  border: amountCents === t.cents ? '2px solid #84cc16' : '1px solid #d7dae0',
                  background: amountCents === t.cents ? '#f4fce8' : '#fff', fontWeight: 700, color: '#1a2e05',
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => start()} disabled={busy} style={btnStyle(busy)}>
            {busy ? 'Processing…' : `Top up ${priceLabel} →`}
          </button>
        </>
      ) : clientSecret ? (
        <Elements stripe={getStripeClient()} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
          <CardForm priceLabel={priceLabel} clientSecret={clientSecret}
            onSucceeded={grantAndRetry} onError={setError}
            onEvent={(step, extra) => {
              track('FUNNEL_STEP', { step, source, amountCents, ...extra });
              // Feed the chat win-back: fire on real friction only (bailed on the form / card declined).
              if (step === 'credit_charge_form_abandon' || step === 'credit_charge_client_error') {
                const sig = `${extra?.code || ''} ${extra?.msg || ''}`;
                const reason = step === 'credit_charge_client_error' && /declin|card|insufficient|do_not_honor|blocked|processing|not_succeeded|expired|cvc|funds/i.test(sig)
                  ? 'card_error' : 'abandon';
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('freelanly:payment-abandoned', { detail: { amountCents, kind: 'topup', reason } }));
                }
              }
            }} />
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
  priceLabel, clientSecret, onSucceeded, onError, onEvent,
}: {
  priceLabel: string; clientSecret: string;
  onSucceeded: (paymentIntentId: string) => Promise<void>; onError: (m: string) => void;
  onEvent: (step: string, extra?: Record<string, unknown>) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  // Abandon tracking: fires on unmount (modal closed / backdrop click) if the user never hit submit.
  const submitted = useRef(false);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  useEffect(() => () => { if (!submitted.current) onEventRef.current('credit_charge_form_abandon'); }, []);

  async function pay() {
    if (!stripe || !elements) return;
    submitted.current = true;
    setBusy(true); onError('');
    // Telemetry: this was a 100% blind zone — 10/10 top-up clicks died between the form and Stripe
    // with zero payment attempts on the PIs. Track submit + the exact client-side error.
    onEvent('credit_charge_submit');
    try {
      // Stripe.js REQUIRES elements.submit() before confirmPayment here (throws an IntegrationError
      // otherwise — caught live via credit_charge_client_error). It also runs form validation.
      const { error: submitError } = await elements.submit();
      if (submitError) {
        onEvent('credit_charge_client_error', { code: submitError.code, type: submitError.type, msg: (submitError.message || '').slice(0, 120) });
        onError(submitError.message || 'Check your card details'); setBusy(false); return;
      }
      // return_url: required by Stripe.js when the Elements instance includes any redirect-capable
      // method (Link/wallets are now active on the domain) — without it confirmPayment THROWS an
      // IntegrationError instead of returning {error}, which left the button spinning forever with
      // no error shown and no telemetry (the exact silent death we saw on prod).
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: { return_url: window.location.href },
        redirect: 'if_required',
      });
      if (error) {
        onEvent('credit_charge_client_error', { code: error.code, type: error.type, msg: (error.message || '').slice(0, 120) });
        onError(error.message || 'Payment failed'); setBusy(false); return;
      }
      if (paymentIntent?.status === 'succeeded') { await onSucceeded(paymentIntent.id); }
      else { onEvent('credit_charge_client_error', { code: 'not_succeeded', msg: paymentIntent?.status }); onError('Payment not completed'); setBusy(false); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      onEvent('credit_charge_client_error', { code: 'exception', msg: msg.slice(0, 160) });
      onError('Payment failed — please try again'); setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ textAlign: 'left', marginBottom: 14 }}>
        <PaymentElement
          onReady={() => { setReady(true); onEvent('credit_charge_form_ready'); }}
          onLoadError={(e) => { onEvent('credit_charge_form_load_error', { msg: (e?.error?.message || '').slice(0, 120) }); onError('Payment form failed to load — try again'); }}
        />
        {!ready && <div style={{ fontSize: 12, color: '#8a8f98', textAlign: 'center', padding: '8px 0' }}>Loading secure payment form…</div>}
      </div>
      <button onClick={pay} disabled={busy || !stripe || !ready} style={btnStyle(busy || !ready)}>
        {busy ? 'Processing…' : `Top up ${priceLabel}`}
      </button>
      <div style={{ fontSize: 11, color: '#8a8f98', marginTop: 8 }}>🔒 Secured by Stripe · card details never touch our servers</div>
    </div>
  );
}
