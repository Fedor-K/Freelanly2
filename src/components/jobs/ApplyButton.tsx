'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QuickApplyModal } from './QuickApplyModal';
import { track } from '@/lib/analytics';

interface ApplyButtonProps {
  jobId: string;
  applyUrl: string | null;
  applyEmail: string | null;
  sourceUrl: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}

export function ApplyButton({
  jobId,
  applyUrl,
  applyEmail,
  sourceUrl,
  jobTitle,
  companyName,
  jobDescription,
}: ApplyButtonProps) {
  const [showQuickApply, setShowQuickApply] = useState(false);

  const handleApplyClick = (method: 'url' | 'email' | 'linkedin') => {
    track({ name: 'job_apply_click', params: { job_id: jobId, method } });
  };

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
