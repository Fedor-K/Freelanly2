'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { trackCheckoutStart, trackSignupStart } from '@/lib/analytics';

interface OpportunityClientInfoProps {
  opportunityId: string;
  isPro: boolean;
  clientName: string;
  clientHeadline?: string | null;
  clientAvatar?: string | null;
  clientLinkedIn: string;
  applyEmail?: string | null;
}

export function OpportunityClientInfo({
  opportunityId,
  isPro,
  clientName,
  clientHeadline,
  clientAvatar,
  clientLinkedIn,
}: OpportunityClientInfoProps) {
  const { data: session } = useSession();
  const [showRegistration, setShowRegistration] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleUpgradeClick = async () => {
    // If not logged in, show registration modal first
    if (!session?.user) {
      trackSignupStart('opportunity_contact');
      setShowRegistration(true);
      return;
    }

    // User is logged in — redirect directly to Stripe checkout
    trackCheckoutStart({ plan: 'monthly', source: 'opportunity_contact' });
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
      <div className="flex items-start gap-4 mb-6">
        <div>
          {clientAvatar ? (
            <Image
              src={clientAvatar}
              alt={clientName}
              width={64}
              height={64}
              className={`rounded-full object-cover ${!isPro ? 'blur-[3px]' : ''}`}
            />
          ) : (
            <div
              className={`w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-2xl ${!isPro ? 'blur-[3px]' : ''}`}
            >
              {clientName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <h2
            className={`text-lg font-semibold ${!isPro ? 'blur-[3px] select-none' : ''}`}
          >
            {clientName}
          </h2>
          {clientHeadline && (
            <p
              className={`text-sm text-muted-foreground ${!isPro ? 'blur-[3px] select-none' : ''}`}
            >
              {clientHeadline}
            </p>
          )}
          {isPro ? (
            <a
              href={clientLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline mt-1 inline-block"
            >
              View LinkedIn Profile →
            </a>
          ) : (
            <button
              onClick={handleUpgradeClick}
              disabled={isRedirecting}
              className="text-sm text-orange-600 hover:underline mt-1 inline-flex items-center gap-1 disabled:opacity-50"
            >
              <span className="blur-[3px] select-none">linkedin.com/in/•••••</span>
              <span className="no-blur">
                {isRedirecting ? 'Redirecting...' : 'Upgrade to see →'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Registration Modal for non-authenticated users */}
      <RegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        callbackUrl="/pricing?plan=monthly"
      />
    </>
  );
}
