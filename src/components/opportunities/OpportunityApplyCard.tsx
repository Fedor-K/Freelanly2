'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RegistrationModal } from '@/components/auth/RegistrationModal';
import { trackSignupStart } from '@/lib/analytics';
import { useTracker } from '@/hooks/useTracker';

interface OpportunityApplyCardProps {
  opportunityId: string;
  isPro: boolean;
  clientLinkedIn: string;
  applyEmail?: string | null;
  applyUrl?: string | null;
  title: string;
  clientName?: string;
  postedAt?: Date | string;
  budget?: string | null;
}

export function OpportunityApplyCard({
  opportunityId,
  isPro,
  clientLinkedIn,
  applyEmail,
  applyUrl,
  title,
  clientName,
}: OpportunityApplyCardProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { track: trackDb } = useTracker();
  const [showRegistration, setShowRegistration] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [coverLetterPreview, setCoverLetterPreview] = useState<string | null>(null);

  const canSeeContacts = isPro || !!session?.user;

  const handleQuickApply = async () => {
    setApplying(true);
    setApplyError(null);
    try {
      const res = await fetch('/api/user/quick-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setApplied(true);
        setCoverLetterPreview(data.coverLetter);
        trackDb('OPPORTUNITY_APPLY_CLICK', { opportunityId, title, method: 'quick_apply' });
      } else if (data.error === 'smtp_required') {
        setApplyError('Connect your email first. Go to Auto-Apply settings.');
      } else if (data.error === 'resume_required') {
        setApplyError('Upload your resume first. Go to Auto-Apply settings.');
      } else if (data.error === 'limit_reached') {
        setApplyError(data.message);
      } else if (data.error === 'already_applied') {
        setApplyError('You already applied to this project.');
      } else {
        setApplyError(data.message || 'Failed to send. Try again.');
      }
    } catch {
      setApplyError('Network error. Try again.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <>
      <Card className="sticky top-4 border-orange-200">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <span className="text-orange-500">⚡</span> Apply Now — Be First
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {canSeeContacts ? (
            <>
              {applied ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-semibold mb-2">Application sent!</p>
                  <p className="text-sm text-green-700 mb-3">AI cover letter was sent to {applyEmail}. You&apos;ll be notified when they open or reply.</p>
                  {coverLetterPreview && (
                    <details className="text-sm">
                      <summary className="text-green-600 cursor-pointer hover:underline">View sent cover letter</summary>
                      <div className="mt-2 bg-white p-3 rounded border text-gray-700 whitespace-pre-wrap text-xs">
                        {coverLetterPreview}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Direct contact with the client. No agencies, no middlemen.
                  </p>

                  {applyEmail && (
                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700 font-semibold text-base py-5"
                      onClick={handleQuickApply}
                      disabled={applying}
                    >
                      {applying ? 'AI is writing & sending...' : 'Apply with AI Cover Letter'}
                    </Button>
                  )}

                  {applyError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm text-red-700">{applyError}</p>
                      {(applyError.includes('email first') || applyError.includes('resume first')) && (
                        <a href="/dashboard/auto-apply" className="text-sm text-red-600 underline mt-1 inline-block">
                          Go to settings →
                        </a>
                      )}
                      {applyError.includes('Upgrade') && (
                        <a href="/pricing" className="text-sm text-red-600 underline mt-1 inline-block">
                          Upgrade to PRO →
                        </a>
                      )}
                    </div>
                  )}

                  {/* LinkedIn and manual email buttons removed — AI apply is the primary action */}

                  {applyUrl && (
                    <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <Button variant="outline" className="w-full">Apply via Link</Button>
                    </a>
                  )}
                </>
              )}

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  ⚡ This project was posted recently. Clients often hire within 48 hours — act now.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Client&apos;s email and LinkedIn are on this page. Sign up to see them and apply.
              </p>

              <Button
                className="w-full bg-orange-600 hover:bg-orange-700 font-semibold"
                onClick={() => {
                  trackSignupStart('opportunity_apply_card');
                  setShowRegistration(true);
                }}
              >
                Sign Up Free to Apply
              </Button>

              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  Free account: see all contacts + 5 AI-powered applies per day.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <RegistrationModal
        open={showRegistration}
        onClose={() => setShowRegistration(false)}
        callbackUrl={pathname}
      />
    </>
  );
}
