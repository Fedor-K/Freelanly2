'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { QuickApplyModal } from './QuickApplyModal';
import { UpgradeModal } from './UpgradeModal';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { track, trackApplyClick, trackSignupStart, trackUpgradeClick } from '@/lib/analytics';
import { useTracker } from '@/hooks/useTracker';

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
  postedAt?: Date | string;
  budget?: string | null;
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
  postedAt,
  budget,
}: ApplyButtonProps) {
  const pathname = usePathname();
  const { track: trackDb } = useTracker();
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE';

  const handleApplyClick = (method: 'url' | 'email' | 'linkedin') => {
    track({ name: 'job_apply_click', params: { job_id: jobId, method } });
    // Also track for Vercel Drains
    trackApplyClick({ jobId, jobTitle, company: companyName, userPlan });
    // DB tracking
    trackDb('JOB_APPLY', { jobId, jobTitle, company: companyName, method });
    // Track in DB for all users (non-blocking)
    fetch('/api/user/apply-attempt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, method }),
    }).catch(() => {});
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
              trackDb('REGISTRATION_MODAL_OPEN', { jobId, jobTitle, company: companyName, source: 'job_page' });
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

  // Authenticated FREE users — show upgrade modal
  if (!isPro) {
    return (
      <>
        <div className="space-y-3">
          <button
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-white bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0"
            onClick={() => {
              trackUpgradeClick({ source: 'paywall', jobId });
              trackDb('PAYWALL_HIT', { jobId, jobTitle, company: companyName, type: 'apply' });
              trackDb('UPGRADE_CLICK', { jobId, source: 'paywall' });
              setShowUpgrade(true);
            }}
          >
            Открыть контакт и откликнуться
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Контакт на этой странице. От €0.39/день.
          </p>
        </div>
        <UpgradeModal
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          jobId={jobId}
          jobTitle={jobTitle}
          companyName={companyName}
          postedAt={postedAt}
          budget={budget}
        />
      </>
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
          onClick={() => {
            handleApplyClick('url');
            trackDb('JOB_SOURCE_CLICK', { jobId, jobTitle, company: companyName, url: applyUrl });
          }}
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
