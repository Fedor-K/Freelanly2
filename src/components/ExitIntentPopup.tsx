'use client';

import { useState } from 'react';
import { X, Bell, Check } from 'lucide-react';
import { useExitIntent } from '@/hooks/useExitIntent';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics';

export function ExitIntentPopup() {
  const { showPopup, closePopup } = useExitIntent({
    threshold: 50,
    delay: 3000, // Wait 3 seconds before enabling
    cookieName: 'exit_intent_shown',
    cookieDays: 7,
  });

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Track event
      track({
        name: 'job_alert_subscribe',
        params: { source: 'exit_intent' }
      });

      // Subscribe to job alerts
      const response = await fetch('/api/job-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          frequency: 'WEEKLY',
          source: 'exit_intent',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to subscribe');
      }

      setSuccess(true);

      // Close after 2 seconds
      setTimeout(() => {
        closePopup();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    track({
      name: 'job_alert_unsubscribe',
      params: {}
    });
    closePopup();
  };

  if (!showPopup) return null;

  return (
    <Dialog open={showPopup} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </button>

        {success ? (
          // Success state
          <div className="p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">You&apos;re subscribed!</h2>
            <p className="text-muted-foreground">
              Check your inbox for the latest remote jobs.
            </p>
          </div>
        ) : (
          // Form state
          <div className="p-6">
            {/* Icon */}
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Bell className="h-7 w-7 text-primary" />
            </div>

            {/* Header */}
            <h2 className="text-xl font-bold text-center mb-2">
              Don&apos;t miss your perfect remote job!
            </h2>
            <p className="text-center text-muted-foreground mb-6">
              Get 50+ new remote jobs delivered to your inbox every week.
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12"
                  disabled={loading}
                />
                {error && (
                  <p className="text-sm text-red-500 mt-1">{error}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full h-12"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Subscribing...
                  </span>
                ) : (
                  'Subscribe for Free'
                )}
              </Button>
            </form>

            {/* Social proof */}
            <div className="mt-6 flex flex-col items-center gap-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>10,000+ professionals subscribed</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>Unsubscribe anytime</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
