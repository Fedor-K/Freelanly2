'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { trackCheckoutStart, trackSignupStart } from '@/lib/analytics';

interface OpportunityApplyCardProps {
  isPro: boolean;
  clientLinkedIn: string;
  applyEmail?: string | null;
  applyUrl?: string | null;
  title: string;
}

export function OpportunityApplyCard({
  isPro,
  clientLinkedIn,
  applyEmail,
  applyUrl,
  title,
}: OpportunityApplyCardProps) {
  const { data: session } = useSession();
  const [showRegistration, setShowRegistration] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleUpgradeClick = async () => {
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
        body: JSON.stringify({ priceKey: 'monthly' }),
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
            Direct contact with the client. No agencies, no middlemen. Respond
            quickly — freelance projects get filled fast.
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
              {isRedirecting ? 'Redirecting to checkout...' : '🔓 Unlock Contact Info'}
            </Button>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {isPro
                ? '⚡ This project was posted recently. Clients often hire within 48 hours — act now.'
                : '🔒 PRO members see all contact info and can apply directly. Upgrade to stop missing opportunities.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Registration Modal for non-authenticated users */}
      <RegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        callbackUrl="/pricing?plan=monthly"
      />
    </>
  );
}
