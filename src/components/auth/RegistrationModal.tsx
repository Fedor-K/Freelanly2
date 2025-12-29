'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RegistrationForm } from './RegistrationForm';

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
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            Get Started Free
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
