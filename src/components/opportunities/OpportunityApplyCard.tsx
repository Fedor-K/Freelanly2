'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { UpgradeModal } from '@/components/jobs/UpgradeModal';
import { trackSignupStart, trackUpgradeClick } from '@/lib/analytics';
import { useTracker } from '@/hooks/useTracker';

interface OpportunityApplyCardProps {
  opportunityId: string;
  isPro: boolean;
  clientLinkedIn: string;
  applyEmail?: string | null;
  applyUrl?: string | null;
  title: string;
  clientName?: string;
  postedAt?: Date | string;
  budget?: string | null;
}

export function OpportunityApplyCard({
  opportunityId,
  isPro,
  clientLinkedIn,
  applyEmail,
  applyUrl,
  title,
  clientName,
  postedAt,
  budget,
}: OpportunityApplyCardProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { track: trackDb } = useTracker();
  const [showRegistration, setShowRegistration] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleUpgradeClick = () => {
    trackUpgradeClick({ source: 'paywall', jobId: opportunityId });
    trackDb('PAYWALL_HIT', { opportunityId, title, type: 'contact' });

    // If not logged in, show registration modal first
    if (!session?.user) {
      trackSignupStart('opportunity_apply_card');
      setShowRegistration(true);
      return;
    }

    // User is logged in — show upgrade modal
    setShowUpgrade(true);
  };

  return (
    <>
      <Card className="sticky top-4 border-orange-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <span className="text-orange-500">⚡</span> Apply Now — Be First
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {isPro
              ? 'Direct contact with the client. No agencies, no middlemen. Respond quickly — freelance projects get filled fast.'
              : 'Client\'s email and LinkedIn are on this page. Upgrade to see them and apply before others.'}
          </p>

          {isPro ? (
            <a
              href={clientLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              onClick={() => trackDb('OPPORTUNITY_APPLY_CLICK', { opportunityId, title, method: 'linkedin' })}
            >
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Message on LinkedIn
              </Button>
            </a>
          ) : (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 blur-[2px]"
              onClick={handleUpgradeClick}
            >
              Message on LinkedIn
            </Button>
          )}

          {applyEmail &&
            (isPro ? (
              <a
                href={`mailto:${applyEmail}?subject=Re: ${encodeURIComponent(title)}`}
                className="block"
              >
                <Button variant="outline" className="w-full">
                  Email: {applyEmail}
                </Button>
              </a>
            ) : (
              <Button
                variant="outline"
                className="w-full blur-[2px]"
                onClick={handleUpgradeClick}
              >
                Email: •••••@••••.com
              </Button>
            ))}

          {applyUrl &&
            (isPro ? (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full">
                  Apply via Link
                </Button>
              </a>
            ) : (
              <Button
                variant="outline"
                className="w-full blur-[2px]"
                onClick={handleUpgradeClick}
              >
                Apply via Link
              </Button>
            ))}

          {!isPro && (
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={handleUpgradeClick}
            >
              {session?.user ? '🔓 Открыть контакт' : '🔓 Log In to see contact details'}
            </Button>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {isPro
                ? '⚡ This project was posted recently. Clients often hire within 48 hours — act now.'
                : '🔒 Contact info is hidden on FREE plan. PRO members apply directly and get hired faster.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Registration Modal for non-authenticated users */}
      <RegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        callbackUrl={pathname}
      />

      {/* Upgrade Modal for authenticated FREE users */}
      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        jobTitle={title}
        companyName={clientName}
        opportunityId={opportunityId}
        postedAt={postedAt}
        budget={budget}
      />
    </>
  );
}
