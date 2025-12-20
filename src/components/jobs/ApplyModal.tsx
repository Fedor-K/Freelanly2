'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ApplyModalProps {
  jobId: string;
  jobTitle: string;
  companyName: string;
  applyEmail?: string | null;
  applyUrl?: string | null;
  sourceUrl?: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ApplyModal({
  jobId,
  jobTitle,
  companyName,
  applyEmail,
  applyUrl,
  sourceUrl,
  isOpen,
  onClose,
}: ApplyModalProps) {
  const [step, setStep] = useState<'options' | 'form' | 'success'>('options');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
    resumeUrl: '',
  });

  if (!isOpen) return null;

  const handleQuickApply = async () => {
    if (!formData.name || !formData.email) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          ...formData,
        }),
      });

      if (response.ok) {
        setStep('success');
      }
    } catch (error) {
      console.error('Apply error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExternalApply = (url: string) => {
    // Track the click
    fetch('/api/apply/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, type: 'external_click' }),
    }).catch(() => {});

    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl">Apply for {jobTitle}</CardTitle>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </CardHeader>

        <CardContent>
          {step === 'options' && (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Choose how you'd like to apply to {companyName}:
              </p>

              <div className="space-y-3">
                {/* Quick Apply via Freelanly */}
                {applyEmail && (
                  <Button
                    className="w-full justify-start gap-3 h-auto py-4"
                    onClick={() => setStep('form')}
                  >
                    <MailIcon className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Quick Apply via Email</div>
                      <div className="text-xs opacity-80">
                        We'll send your application to {applyEmail}
                      </div>
                    </div>
                  </Button>
                )}

                {/* Direct Apply Link */}
                {applyUrl && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-4"
                    onClick={() => handleExternalApply(applyUrl)}
                  >
                    <ExternalIcon className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">Apply on Company Website</div>
                      <div className="text-xs text-muted-foreground">
                        Opens company's career page
                      </div>
                    </div>
                  </Button>
                )}

                {/* LinkedIn Source */}
                {sourceUrl && sourceUrl.includes('linkedin') && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-3 h-auto py-4"
                    onClick={() => handleExternalApply(sourceUrl)}
                  >
                    <LinkedInIcon className="h-5 w-5" />
                    <div className="text-left">
                      <div className="font-semibold">View on LinkedIn</div>
                      <div className="text-xs text-muted-foreground">
                        Apply via original LinkedIn post
                      </div>
                    </div>
                  </Button>
                )}

                {/* No apply options */}
                {!applyEmail && !applyUrl && !sourceUrl && (
                  <div className="text-center py-4 text-muted-foreground">
                    <p>No direct apply option available.</p>
                    <p className="text-sm mt-2">
                      Search for "{companyName} careers" to find their application page.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'form' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleQuickApply();
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium mb-1 block">Your Name *</label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Your Email *</label>
                <Input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Resume/Portfolio URL (optional)
                </label>
                <Input
                  type="url"
                  value={formData.resumeUrl}
                  onChange={(e) => setFormData({ ...formData, resumeUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Message *</label>
                <textarea
                  required
                  className="w-full min-h-[120px] px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder={`Hi,\n\nI'm interested in the ${jobTitle} position at ${companyName}.\n\n[Tell them why you're a great fit...]`}
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('options')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Sending...' : 'Send Application'}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Your application will be sent directly to {applyEmail}
              </p>
            </form>
          )}

          {step === 'success' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckIcon className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Application Sent!</h3>
              <p className="text-muted-foreground mb-6">
                Your application has been sent to {companyName}.
                Good luck!
              </p>
              <Button onClick={onClose}>Close</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Trigger Button Component
export function ApplyButton({
  onClick,
  className = '',
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button onClick={onClick} size="lg" className={className}>
      Apply Now
    </Button>
  );
}

// Icons
function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function ExternalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
