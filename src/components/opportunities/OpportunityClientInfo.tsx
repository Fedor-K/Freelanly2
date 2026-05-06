'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { UpgradeModal } from '@/components/jobs/UpgradeModal';
import { trackSignupStart } from '@/lib/analytics';
import { useTracker } from '@/hooks/useTracker';

interface OpportunityClientInfoProps {
  opportunityId: string;
  isPro: boolean;
  clientName: string;
  clientHeadline?: string | null;
  clientAvatar?: string | null;
  clientLinkedIn: string;
  applyEmail?: string | null;
  title?: string;
}

export function OpportunityClientInfo({
  opportunityId,
  isPro,
  clientName,
  clientHeadline,
  clientAvatar,
  clientLinkedIn,
  title,
}: OpportunityClientInfoProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { track: trackDb } = useTracker();
  const [showRegistration, setShowRegistration] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // All logged-in users see contacts (FREE gets 5 applies/day)
  const canSeeContacts = isPro || !!session?.user;

  const handleUpgradeClick = () => {
    if (!session?.user) {
      trackSignupStart('opportunity_contact');
      setShowRegistration(true);
      return;
    }
    trackDb('PAYWALL_HIT', { opportunityId, title, type: 'contact' });
    setShowUpgrade(true);
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
              className={`rounded-full object-cover ${!canSeeContacts ? 'blur-[3px]' : ''}`}
            />
          ) : (
            <div
              className={`w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-2xl ${!canSeeContacts ? 'blur-[3px]' : ''}`}
            >
              {clientName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <h2
            className={`text-lg font-semibold ${!canSeeContacts ? 'blur-[3px] select-none' : ''}`}
          >
            {clientName}
          </h2>
          {clientHeadline && (
            <p
              className={`text-sm text-muted-foreground ${!canSeeContacts ? 'blur-[3px] select-none' : ''}`}
            >
              {clientHeadline}
            </p>
          )}
          {canSeeContacts ? (
            <a
              href={clientLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline mt-1 inline-block"
              onClick={() => trackDb('CONTACT_VIEW', { opportunityId, clientName })}
            >
              View LinkedIn Profile →
            </a>
          ) : (
            <button
              onClick={handleUpgradeClick}
              className="text-sm text-orange-600 hover:underline mt-1 inline-flex items-center gap-1"
            >
              <span className="blur-[3px] select-none">linkedin.com/in/•••••</span>
              <span>{session?.user ? 'Upgrade to see →' : 'Log In to see →'}</span>
            </button>
          )}
        </div>
      </div>

      <RegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        callbackUrl={pathname}
      />

      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        opportunityId={opportunityId}
        jobTitle={title}
        companyName={clientName}
      />
    </>
  );
}
