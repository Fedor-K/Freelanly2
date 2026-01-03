'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QuickApplyModal } from './QuickApplyModal';
import { UpgradeModal } from './UpgradeModal';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { track } from '@/lib/analytics';

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
  const [showQuickApply, setShowQuickApply] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const isPro = userPlan === 'PRO' || userPlan === 'ENTERPRISE';

  const handleApplyClick = (method: 'url' | 'email' | 'linkedin') => {
    track({ name: 'job_apply_click', params: { job_id: jobId, method } });
  };

  // Unauthenticated users see registration modal
  if (!isAuthenticated) {
    return (
      <>
        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            track({ name: 'registration_modal_open', params: { job_id: jobId } });
            setShowRegistration(true);
          }}
        >
          Apply Now — Free Trial
        </Button>
        <RegistrationModal
          open={showRegistration}
          onClose={() => setShowRegistration(false)}
          jobId={jobId}
          jobTitle={jobTitle}
          companyName={companyName}
        />
      </>
    );
  }

  // Authenticated FREE users see upgrade modal
  if (!isPro) {
    return (
      <>
        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            track({ name: 'upgrade_modal_open', params: { job_id: jobId } });
            setShowUpgrade(true);
          }}
        >
          Start Free Trial & Apply
        </Button>
        <UpgradeModal
          open={showUpgrade}
          onClose={() => setShowUpgrade(false)}
          jobId={jobId}
          jobTitle={jobTitle}
          companyName={companyName}
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
