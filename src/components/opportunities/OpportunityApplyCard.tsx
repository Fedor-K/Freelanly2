'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UnlockContactModal } from './UnlockContactModal';

interface OpportunityApplyCardProps {
  isPro: boolean;
  clientName: string;
  clientHeadline?: string | null;
  clientLinkedIn: string;
  applyEmail?: string | null;
  applyUrl?: string | null;
  title: string;
}

export function OpportunityApplyCard({
  isPro,
  clientName,
  clientHeadline,
  clientLinkedIn,
  applyEmail,
  applyUrl,
  title,
}: OpportunityApplyCardProps) {
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  return (
    <>
      <Card className="sticky top-4 border-orange-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <span className="text-orange-500">⚡</span> Apply Now — Be First
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Direct contact with the client. No agencies, no middlemen. Respond
            quickly — freelance projects get filled fast.
          </p>

          {isPro ? (
            <a
              href={clientLinkedIn}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Button className="w-full bg-blue-600 hover:bg-blue-700">
                Message on LinkedIn
              </Button>
            </a>
          ) : (
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 blur-[2px]"
              onClick={() => setShowUnlockModal(true)}
            >
              Message on LinkedIn
            </Button>
          )}

          {applyEmail &&
            (isPro ? (
              <a
                href={`mailto:${applyEmail}?subject=Re: ${encodeURIComponent(title)}`}
                className="block"
              >
                <Button variant="outline" className="w-full">
                  Email: {applyEmail}
                </Button>
              </a>
            ) : (
              <Button
                variant="outline"
                className="w-full blur-[2px]"
                onClick={() => setShowUnlockModal(true)}
              >
                Email: •••••@••••.com
              </Button>
            ))}

          {applyUrl &&
            (isPro ? (
              <a
                href={applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="outline" className="w-full">
                  Apply via Link
                </Button>
              </a>
            ) : (
              <Button
                variant="outline"
                className="w-full blur-[2px]"
                onClick={() => setShowUnlockModal(true)}
              >
                Apply via Link
              </Button>
            ))}

          {!isPro && (
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700"
              onClick={() => setShowUnlockModal(true)}
            >
              🔓 Unlock Contact Info
            </Button>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {isPro
                ? '⚡ This project was posted recently. Clients often hire within 48 hours — act now.'
                : '🔒 PRO members see all contact info and can apply directly. Upgrade to stop missing opportunities.'}
            </p>
          </div>
        </CardContent>
      </Card>

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
