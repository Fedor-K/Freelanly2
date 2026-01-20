'use client';

import { useState } from 'react';
import Image from 'next/image';
import { UnlockContactModal } from './UnlockContactModal';

interface OpportunityClientInfoProps {
  isPro: boolean;
  clientName: string;
  clientHeadline?: string | null;
  clientAvatar?: string | null;
  clientLinkedIn: string;
  applyEmail?: string | null;
  title: string;
}

export function OpportunityClientInfo({
  isPro,
  clientName,
  clientHeadline,
  clientAvatar,
  clientLinkedIn,
  applyEmail,
  title,
}: OpportunityClientInfoProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  return (
    <>
      <div className="flex items-start gap-4 mb-6">
        <div>
          {clientAvatar ? (
            <Image
              src={clientAvatar}
              alt={clientName}
              width={64}
              height={64}
              className={`rounded-full object-cover ${!isPro ? 'blur-[3px]' : ''}`}
            />
          ) : (
            <div
              className={`w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-bold text-2xl ${!isPro ? 'blur-[3px]' : ''}`}
            >
              {clientName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1">
          <h2
            className={`text-lg font-semibold ${!isPro ? 'blur-[3px] select-none' : ''}`}
          >
            {clientName}
          </h2>
          {clientHeadline && (
            <p
              className={`text-sm text-muted-foreground ${!isPro ? 'blur-[3px] select-none' : ''}`}
            >
              {clientHeadline}
            </p>
          )}
          {isPro ? (
            <a
              href={clientLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline mt-1 inline-block"
            >
              View LinkedIn Profile →
            </a>
          ) : (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="text-sm text-orange-600 hover:underline mt-1 inline-flex items-center gap-1"
            >
              <span className="blur-[3px] select-none">linkedin.com/in/•••••</span>
              <span className="no-blur">Upgrade to see →</span>
            </button>
          )}
        </div>
      </div>

      {/* Unlock Modal */}
      <UnlockContactModal
        open={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        clientName={clientName}
        clientHeadline={clientHeadline}
        hasEmail={!!applyEmail}
        opportunityTitle={title}
      />
    </>
  );
}
