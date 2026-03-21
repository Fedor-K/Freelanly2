'use client';

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

/**
 * Handles return from payment providers (Stripe/PayPro).
 * If ?payment=success is in URL and paymentReturnUrl is in localStorage,
 * redirects user back to the page they came from.
 */
export function PaymentReturnHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const payment = searchParams.get('payment');
    if (payment === 'success') {
      const returnUrl = localStorage.getItem('paymentReturnUrl');
      if (returnUrl) {
        localStorage.removeItem('paymentReturnUrl');
        // Small delay so user sees the page loaded
        setTimeout(() => {
          router.push(returnUrl);
        }, 1500);
      }
    }
  }, [searchParams, router]);

  return null;
}
