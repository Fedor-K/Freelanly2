'use client';

import { useState } from 'react';
import { RegistrationModal } from './RegistrationModal';

interface StartFreeButtonProps {
  className?: string;
  children: React.ReactNode;
  callbackUrl?: string;
}

export function StartFreeButton({ className, children, callbackUrl }: StartFreeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>
        {children}
      </button>
      <RegistrationModal
        open={open}
        onClose={() => setOpen(false)}
        callbackUrl={callbackUrl || '/dashboard'}
      />
    </>
  );
}
