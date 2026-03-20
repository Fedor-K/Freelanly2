'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { UpgradeModal } from '@/components/jobs/UpgradeModal';
import { trackSignupStart } from '@/lib/analytics';

interface OpportunityOriginalPostFooterProps {
  opportunityId: string;
  isPro: boolean;
  sourceUrl: string;
  applyEmail?: string | null;
  title?: string;
  clientName?: string;
}

export function OpportunityOriginalPostFooter({
  opportunityId,
  isPro,
  sourceUrl,
  title,
  clientName,
}: OpportunityOriginalPostFooterProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showRegistration, setShowRegistration] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleUpgradeClick = () => {
    if (!session?.user) {
      trackSignupStart('opportunity_footer');
      setShowRegistration(true);
      return;
    }
    setShowUpgrade(true);
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
            className="text-sm text-orange-600 hover:underline"
          >
            {session?.user ? 'Upgrade to view on LinkedIn →' : 'Log In to view on LinkedIn →'}
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
