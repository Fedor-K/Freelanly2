'use client';

import { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RegistrationForm } from './RegistrationForm';
import { useTracker } from '@/hooks/useTracker';

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
  jobId?: string;
  jobTitle?: string;
  companyName?: string;
  callbackUrl?: string;
}

export function RegistrationModal({
  open,
  onClose,
  jobId,
  jobTitle,
  companyName,
  callbackUrl,
}: RegistrationModalProps) {
  const { track: trackDb } = useTracker();
  const trackedRef = useRef(false);

  useEffect(() => {
    if (open && !trackedRef.current) {
      trackedRef.current = true;
      trackDb('REGISTRATION_MODAL_OPEN', { jobId, jobTitle, company: companyName });
    }
    if (!open) {
      trackedRef.current = false;
    }
  }, [open, jobId, jobTitle, companyName, trackDb]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            See recruiter contact details — takes 30 seconds
          </DialogTitle>
          <DialogDescription className="text-center">
            {jobTitle && companyName ? (
              <>Apply to <strong>{jobTitle}</strong> at <strong>{companyName}</strong></>
            ) : (
              <>Create an account to apply to jobs and get instant alerts</>
            )}
          </DialogDescription>
        </DialogHeader>

        <RegistrationForm
          jobId={jobId}
          jobTitle={jobTitle}
          companyName={companyName}
          callbackUrl={callbackUrl}
          showJobContext={false}
        />
      </DialogContent>
    </Dialog>
  );
}
