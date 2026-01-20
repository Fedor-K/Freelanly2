'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { trackCheckoutStart, trackSignupStart } from '@/lib/analytics';

interface UnlockContactModalProps {
  open: boolean;
  onClose: () => void;
  hasEmail?: boolean;
}

export function UnlockContactModal({
  open,
  onClose,
  hasEmail,
}: UnlockContactModalProps) {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);

  const handleQuickUpgrade = async () => {
    setError(null);

    // If not logged in, show registration modal
    if (!session?.user) {
      trackSignupStart('unlock_modal');
      setShowRegistration(true);
      return;
    }

    // Track and redirect to checkout
    trackCheckoutStart({ plan: 'monthly', source: 'unlock_modal' });
    setLoading(true);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey: 'monthly' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">🔓</span> Unlock this contact
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* What you'll get */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                You'll get access to:
              </p>

              {/* Benefits list */}
              <ul className="space-y-1.5 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Full name and company
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Direct LinkedIn profile link
                </li>
                {hasEmail && (
                  <li className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>
                    Direct email address
                  </li>
                )}
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Message them directly — skip HR
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Unlimited unlocks for all opportunities
                </li>
              </ul>
            </div>

            {/* Price highlight */}
            <div className="text-center py-2">
              <p className="text-2xl font-bold">€0.50<span className="text-base font-normal text-muted-foreground">/day</span></p>
              <p className="text-sm text-muted-foreground">€15/month · Cancel anytime</p>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {/* CTA buttons */}
            <div className="space-y-2">
              <Button
                className="w-full bg-orange-600 hover:bg-orange-700"
                size="lg"
                onClick={handleQuickUpgrade}
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  'Unlock Now'
                )}
              </Button>

              <Link href="/pricing" className="block">
                <Button variant="outline" className="w-full" onClick={onClose}>
                  Compare all plans
                </Button>
              </Link>
            </div>

            {/* Trust signals */}
            <p className="text-xs text-center text-muted-foreground">
              🔒 Secure payment via Stripe
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registration Modal for non-authenticated users */}
      <RegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        callbackUrl={`/pricing?plan=monthly`}
      />
    </>
  );
}
