import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Single loadStripe promise for the whole client (Stripe.js recommends loading once).
//
// ⚠️ LAZY BY CONTRACT: call this on payment INTENT (top-up click / card form mount), never at
// module level. Module-level calls made every /freelance visitor download js.stripe.com — and
// surfaced ~28/day "Failed to load Stripe.js" unhandled rejections from US ad-blockers (uBlock/
// Brave) on people who never meant to pay. Lazy-loading confines the request (and the failure)
// to actual payers, where we can show a useful "disable your ad-blocker" message instead.
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripeClient(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    // .catch → null: loadStripe REJECTS when the script is blocked (ad-blocker/network). Swallow it
    // here so callers uniformly handle `null` = "Stripe unavailable" and nothing hits window.onerror.
    // Reset the cached promise on failure so a retry after disabling the blocker can succeed.
    stripePromise = key
      ? loadStripe(key).catch(() => { stripePromise = null; return null; })
      : Promise.resolve(null);
  }
  return stripePromise;
}

/** User-facing message for the `null` (blocked/failed) case. */
export const STRIPE_BLOCKED_MSG = 'Payment form couldn’t load — an ad-blocker or privacy shield (uBlock, Brave) may be blocking Stripe. Disable it for this site and try again.';
