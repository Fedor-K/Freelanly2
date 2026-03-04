'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { QuickApplyModal } from './QuickApplyModal';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { track, trackApplyClick, trackSignupStart, trackUpgradeClick, trackCheckoutStart } from '@/lib/analytics';

export type UserPlan = 'FREE' | 'PRO' | 'ENTERPRISE';

interface ApplyButtonProps {
  jobId: string;
  applyUrl: string | null;
  applyEmail: string | null;
  sourceUrl: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  userPlan?: UserPlan;
  isAuthenticated?: boolean;
}

export function ApplyButton({
  jobId,
  applyUrl,
  applyEmail,
  sourceUrl,
  jobTitle,
  companyName,
  jobDescription,
  userPlan = 'FREE',
  isAuthenticated = false,
}: ApplyButtonProps) {
  const pathname = usePathname();
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE';

  const handleApplyClick = (method: 'url' | 'email' | 'linkedin') => {
    track({ name: 'job_apply_click', params: { job_id: jobId, method } });
    // Also track for Vercel Drains
    trackApplyClick({ jobId, jobTitle, company: companyName, userPlan });
  };

  // Unauthenticated users see registration modal
  if (!isAuthenticated) {
    return (
      <>
        <div className="space-y-3">
          <button
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => {
              track({ name: 'registration_modal_open', params: { job_id: jobId } });
              trackSignupStart('job_page');
              setShowRegistration(true);
            }}
          >
            Log In to see contact details
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Free to sign up. Takes 30 seconds.
          </p>
        </div>
        <RegistrationModal
          open={showRegistration}
          onClose={() => setShowRegistration(false)}
          jobId={jobId}
          jobTitle={jobTitle}
          companyName={companyName}
          callbackUrl={pathname}
        />
      </>
    );
  }

  // Authenticated FREE users go directly to Stripe checkout
  if (!isPro) {
    const handleUpgradeClick = async () => {
      trackUpgradeClick({ source: 'paywall', jobId });
      trackCheckoutStart({ plan: 'monthly', source: 'job_page' });
      setIsRedirecting(true);

      try {
        const response = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            priceKey: 'monthly',
            source: 'job_page',
            jobId,
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
      <div className="space-y-3">
        <button
          className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
          onClick={handleUpgradeClick}
          disabled={isRedirecting}
        >
          {isRedirecting ? 'Redirecting to checkout...' : 'Upgrade to see contact details'}
        </button>
        <p className="text-xs text-center text-muted-foreground">
          Contact details are on this page. From €0.39/day.
        </p>
      </div>
    );
  }

  // Priority 1: Direct apply URL (ATS)
  if (applyUrl) {
    return (
      <Button className="w-full" size="lg" asChild>
        <a
          href={applyUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleApplyClick('url')}
        >
          Apply Now
        </a>
      </Button>
    );
  }

  // Priority 2: Email apply (Quick Apply)
  if (applyEmail) {
    return (
      <>
        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            handleApplyClick('email');
            setShowQuickApply(true);
          }}
        >
          Quick Apply
        </Button>
        <QuickApplyModal
          open={showQuickApply}
          onClose={() => setShowQuickApply(false)}
          email={applyEmail}
          jobTitle={jobTitle}
          companyName={companyName}
          jobDescription={jobDescription}
        />
      </>
    );
  }

  // Priority 3: Source URL (LinkedIn post, etc.)
  return (
    <Button className="w-full" size="lg" asChild>
      <a
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => handleApplyClick('linkedin')}
      >
        Apply Now
      </a>
    </Button>
  );
}
