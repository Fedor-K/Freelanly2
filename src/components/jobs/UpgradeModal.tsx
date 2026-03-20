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

    trackDb('PRICING_PLAN_CLICK', { plan: priceKey, source: 'upgrade_modal' });
    trackDb('CHECKOUT_START', { plan: priceKey, source: 'upgrade_modal' });
    trackedRef.current = false; // Don't fire PAYWALL_CLOSE

    try {
      const response = await fetch('/api/stripe/checkout', {
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Zap className="h-5 w-5 text-orange-500" />
            Unlock PRO Access
          </DialogTitle>
        </DialogHeader>

        {/* Job context + value prop */}
        <div className="text-sm text-muted-foreground -mt-2 space-y-1">
          {jobTitle && (
            <p>Get contact details for <strong>{jobTitle}</strong></p>
          )}
          <p>Unlimited access to all contacts, apply to any job, get email alerts — for the entire subscription period.</p>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 p-2 rounded">{error}</p>
        )}

        {/* Pricing cards */}
        <div className="space-y-2">
          {plans.map(({ key, badge }) => {
            const info = PRICE_INFO[key];
            const isLoading = loading === key;
            const isPopular = info.popular;

            return (
              <button
                key={key}
                onClick={() => handleSubscribe(key)}
                disabled={loading !== null}
                className={`w-full flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                  isPopular
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/50'
                } ${loading !== null && !isLoading ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{info.name}</span>
                      {badge && (
                        <Badge variant={isPopular ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                          {badge}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {info.pricePerDay}/day · Cancel anytime
                      {info.savings && <span className="text-green-600 ml-1">({info.savings})</span>}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      {info.originalPrice && (
                        <span className="text-sm text-muted-foreground line-through mr-1">{info.originalPrice}</span>
                      )}
                      <span className="text-lg font-bold">{info.price}</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Benefits */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> Direct contacts</span>
          <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> Apply first</span>
          <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> Salary insights</span>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Secure payment by Stripe
        </p>
      </DialogContent>
    </Dialog>
  );
}
