'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { trackCheckoutStart, trackSignupStart } from '@/lib/analytics';

interface OpportunityOriginalPostFooterProps {
  opportunityId: string;
  isPro: boolean;
  sourceUrl: string;
  applyEmail?: string | null;
}

export function OpportunityOriginalPostFooter({
  opportunityId,
  isPro,
  sourceUrl,
}: OpportunityOriginalPostFooterProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showRegistration, setShowRegistration] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleUpgradeClick = async () => {
    if (!session?.user) {
      trackSignupStart('opportunity_footer');
      setShowRegistration(true);
      return;
    }

    trackCheckoutStart({ plan: 'monthly', source: 'opportunity_footer' });
    setIsRedirecting(true);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceKey: 'monthly',
          source: 'opportunity_page',
          opportunityId,
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setIsRedirecting(false);
    }
  };

  return (
    <>
      <div className="mt-4 pt-4 border-t flex items-center justify-between">
        {isPro ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            View on LinkedIn →
          </a>
        ) : (
          <button
            onClick={handleUpgradeClick}
            disabled={isRedirecting}
            className="text-sm text-orange-600 hover:underline disabled:opacity-50"
          >
            {isRedirecting ? 'Redirecting...' : 'Upgrade to view on LinkedIn →'}
          </button>
        )}
        {!isPro && (
          <span className="text-xs text-muted-foreground">
            Contact details hidden
          </span>
        )}
      </div>

      <RegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        callbackUrl={pathname}
      />
    </>
  );
}
