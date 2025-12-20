'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { QuickApplyModal } from './QuickApplyModal';

interface ApplyButtonProps {
  applyUrl: string | null;
  applyEmail: string | null;
  sourceUrl: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
}

export function ApplyButton({
  applyUrl,
  applyEmail,
  sourceUrl,
  jobTitle,
  companyName,
  jobDescription,
}: ApplyButtonProps) {
  const [showQuickApply, setShowQuickApply] = useState(false);

  // Priority 1: Direct apply URL (ATS)
  if (applyUrl) {
    return (
      <Button className="w-full" size="lg" asChild>
        <a href={applyUrl} target="_blank" rel="noopener noreferrer">
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
          onClick={() => setShowQuickApply(true)}
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
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
        Apply Now
      </a>
    </Button>
  );
}
