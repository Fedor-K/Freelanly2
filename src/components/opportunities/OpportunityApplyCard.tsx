'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { trackCheckoutStart, trackSignupStart, trackUpgradeClick } from '@/lib/analytics';

interface OpportunityApplyCardProps {
  opportunityId: string;
  isPro: boolean;
  clientLinkedIn: string;
  applyEmail?: string | null;
  applyUrl?: string | null;
  title: string;
}

export function OpportunityApplyCard({
  opportunityId,
  isPro,
  clientLinkedIn,
  applyEmail,
  applyUrl,
  title,
}: OpportunityApplyCardProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [showRegistration, setShowRegistration] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const trackedRef = useRef(false);

  // Track apply attempt when FREE user clicks on any apply button
  const trackApplyAttempt = () => {
    if (trackedRef.current) return;
    trackedRef.current = true;

    fetch('/api/user/apply-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId }),
    }).catch(() => {});
  };

  // Reset tracking when component unmounts or opportunityId changes
  useEffect(() => {
    return () => {
      trackedRef.current = false;
    };
  }, [opportunityId]);

  const handleUpgradeClick = async () => {
    // Track the apply attempt for conversion analytics
    trackApplyAttempt();
    trackUpgradeClick({ source: 'paywall', jobId: opportunityId });

    // If not logged in, show registration modal first
    if (!session?.user) {
      trackSignupStart('opportunity_apply_card');
      setShowRegistration(true);
      return;
    }

    // User is logged in — redirect directly to Stripe checkout
    trackCheckoutStart({ plan: 'monthly', source: 'opportunity_apply_card' });
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
            >
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Message on LinkedIn
              </Button>
            </a>
          ) : (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 blur-[2px]"
              onClick={handleUpgradeClick}
              disabled={isRedirecting}
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
                disabled={isRedirecting}
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
                disabled={isRedirecting}
              >
                Apply via Link
              </Button>
            ))}

          {!isPro && (
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={handleUpgradeClick}
              disabled={isRedirecting}
            >
              {isRedirecting ? 'Redirecting...' : session?.user ? '🔓 Upgrade to see contact details' : '🔓 Log In to see contact details'}
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
    </>
  );
}
