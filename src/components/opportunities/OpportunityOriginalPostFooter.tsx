'use client';

import { useState } from 'react';
import { UnlockContactModal } from './UnlockContactModal';

interface OpportunityOriginalPostFooterProps {
  isPro: boolean;
  sourceUrl: string;
  applyEmail?: string | null;
}

export function OpportunityOriginalPostFooter({
  isPro,
  sourceUrl,
  applyEmail,
}: OpportunityOriginalPostFooterProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  return (
    <>
      <div className="mt-4 pt-4 border-t flex items-center justify-between">
        {isPro ? (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            View on LinkedIn →
          </a>
        ) : (
          <button
            onClick={() => setShowUnlockModal(true)}
            className="text-sm text-orange-600 hover:underline"
          >
            Upgrade to view on LinkedIn →
          </button>
        )}
        {!isPro && (
          <span className="text-xs text-muted-foreground">
            Contact details hidden
          </span>
        )}
      </div>

      {/* Unlock Modal */}
      <UnlockContactModal
        open={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        hasEmail={!!applyEmail}
      />
    </>
  );
}
