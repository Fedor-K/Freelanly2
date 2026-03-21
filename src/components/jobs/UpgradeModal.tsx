'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTracker } from '@/hooks/useTracker';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Check, Loader2 } from 'lucide-react';
import { PRICE_INFO, type PriceKey } from '@/lib/stripe';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
  postedAt?: Date | string;
  budget?: string | null;
  viewCount?: number;
  opportunityId?: string;
}

const plans: Array<{ key: PriceKey; badge?: string }> = [
  { key: 'monthly', badge: 'Most Popular' },
  { key: 'quarterly' },
  { key: 'annual', badge: 'Best Value' },
];

export function UpgradeModal({
  open,
  onClose,
  jobId,
  jobTitle,
  companyName,
  postedAt,
  budget,
  viewCount,
  opportunityId,
}: UpgradeModalProps) {
  const { track: trackDb } = useTracker();
  const trackedRef = useRef(false);
  const [loading, setLoading] = useState<PriceKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentProvider, setPaymentProvider] = useState<'stripe' | 'paypro'>('stripe');

  // Track apply attempt when modal opens
  useEffect(() => {
    if (open && (jobId || opportunityId) && !trackedRef.current) {
      trackedRef.current = true;
      trackDb('UPGRADE_MODAL_OPEN', { jobId, opportunityId, jobTitle, company: companyName });
      fetch('/api/user/apply-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opportunityId ? { opportunityId } : { jobId }),
      }).catch(() => {});
    }
    if (!open) {
      if (trackedRef.current) {
        trackDb('PAYWALL_CLOSE', { jobId, opportunityId, jobTitle, company: companyName, result: 'closed' });
      }
      trackedRef.current = false;
    }
  }, [open, jobId, opportunityId, jobTitle, companyName, trackDb]);

  const handleSubscribe = async (priceKey: PriceKey) => {
    setError(null);
    setLoading(priceKey);

    trackDb('PRICING_PLAN_CLICK', { plan: priceKey, source: 'upgrade_modal', provider: paymentProvider });
    trackDb('CHECKOUT_START', { plan: priceKey, source: 'upgrade_modal', provider: paymentProvider });
    trackedRef.current = false; // Don't fire PAYWALL_CLOSE

    const endpoint = paymentProvider === 'paypro' ? '/api/paypro/checkout' : '/api/stripe/checkout';

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceKey,
          source: 'upgrade_modal',
          ...(jobId && { jobId }),
          ...(opportunityId && { opportunityId }),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-5 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl text-white">
              <Zap className="h-6 w-6" fill="white" />
              Unlock PRO Access
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 text-sm text-white/90 space-y-0.5">
            {jobTitle && (
              <p>Get contact details for <strong className="text-white">{jobTitle}</strong></p>
            )}
            <p>Unlimited contacts · Apply to any job · Email alerts</p>
          </div>
        </div>

        <div className="px-6 py-4 space-y-3">
          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</p>
          )}

          {/* Pricing cards */}
          {plans.map(({ key, badge }) => {
            const info = PRICE_INFO[key];
            const isLoading = loading === key;
            const isPopular = info.popular;

            return (
              <button
                key={key}
                onClick={() => handleSubscribe(key)}
                disabled={loading !== null}
                className={`w-full flex items-center justify-between p-4 rounded-xl transition-all text-left ${
                  isPopular
                    ? 'bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-400 shadow-md shadow-orange-100'
                    : 'bg-gray-50 border-2 border-gray-200 hover:border-orange-300 hover:bg-orange-50/30'
                } ${loading !== null && !isLoading ? 'opacity-40' : ''}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${isPopular ? 'text-orange-700' : ''}`}>{info.name}</span>
                    {badge && (
                      <Badge className={`text-[10px] px-1.5 py-0 ${isPopular ? 'bg-orange-500 hover:bg-orange-500' : 'bg-gray-500 hover:bg-gray-500'}`}>
                        {badge}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {info.pricePerDay}/day · Cancel anytime
                    {info.savings && <span className="text-green-600 font-medium ml-1">{info.savings}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                  ) : (
                    <div>
                      {info.originalPrice && (
                        <span className="text-xs text-muted-foreground line-through block">{info.originalPrice}</span>
                      )}
                      <span className={`text-xl font-bold ${isPopular ? 'text-orange-600' : ''}`}>{info.price}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}

          {/* Benefits */}
          <div className="flex justify-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-500" /> Direct contacts</span>
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-500" /> Apply first</span>
            <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-500" /> Alerts</span>
          </div>

          {/* Payment provider toggle */}
          <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
            <button
              onClick={() => setPaymentProvider('stripe')}
              className={`px-2 py-1 rounded ${paymentProvider === 'stripe' ? 'bg-gray-200 font-medium text-gray-800' : 'hover:bg-gray-100'}`}
            >
              💳 Card (Stripe)
            </button>
            <button
              onClick={() => setPaymentProvider('paypro')}
              className={`px-2 py-1 rounded ${paymentProvider === 'paypro' ? 'bg-gray-200 font-medium text-gray-800' : 'hover:bg-gray-100'}`}
            >
              🌍 More methods (PayPro)
            </button>
          </div>
          <p className="text-center text-[10px] text-muted-foreground pb-1">
            Secure payment · Cancel anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
