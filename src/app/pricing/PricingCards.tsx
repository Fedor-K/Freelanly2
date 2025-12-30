'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { PRICE_INFO, type PriceKey } from '@/lib/stripe';

const plans: Array<{
  key: PriceKey;
  badge?: string;
}> = [
  { key: 'monthly' },
  { key: 'quarterly', badge: 'Most Popular' },
  { key: 'annual', badge: 'Best Value' },
];

export function PricingCards() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState<PriceKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRegistration, setShowRegistration] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PriceKey | null>(null);

  const handleSubscribe = async (priceKey: PriceKey) => {
    setError(null);

    // If not logged in, show registration modal
    if (!session?.user) {
      setSelectedPlan(priceKey);
      setShowRegistration(true);
      return;
    }

    setLoading(priceKey);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="max-w-md mx-auto p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {plans.map(({ key, badge }) => {
          const info = PRICE_INFO[key];
          const isLoading = loading === key;
          const isPopular = info.popular;

          return (
            <Card
              key={key}
              className={`relative ${isPopular ? 'border-primary shadow-lg md:scale-105' : ''}`}
            >
              {badge && (
                <Badge
                  className="absolute -top-3 left-1/2 -translate-x-1/2"
                  variant={isPopular ? 'default' : 'secondary'}
                >
                  {badge}
                </Badge>
              )}

              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">{info.name}</CardTitle>

                {/* Price per day */}
                <p className="text-sm text-muted-foreground mt-2">
                  {info.pricePerDay} per day • Cancel anytime
                </p>

                {/* Main price */}
                <div className="mt-3">
                  {info.originalPrice && (
                    <span className="text-lg text-muted-foreground line-through mr-2">
                      {info.originalPrice}
                    </span>
                  )}
                  <span className="text-4xl font-bold">{info.price}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {key === 'quarterly' ? 'for 3 months' : `per ${info.period}`}
                </p>

                {/* Savings badge */}
                {info.savings && (
                  <p className="text-sm text-green-600 font-medium mt-2">
                    {info.savings}
                  </p>
                )}
              </CardHeader>

              <CardContent className="pt-4">
                <Button
                  className="w-full"
                  variant={isPopular ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(key)}
                  disabled={loading !== null}
                >
                  {isLoading ? (
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
                    'Get Started'
                  )}
                </Button>

                {status === 'unauthenticated' && (
                  <p className="text-xs text-center text-muted-foreground mt-3">
                    You'll be asked to sign in first
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Secure payment powered by Stripe. Cancel anytime.
      </p>

      {/* Registration Modal */}
      <RegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        callbackUrl={selectedPlan ? `/pricing?plan=${selectedPlan}` : '/pricing'}
      />
    </div>
  );
}
