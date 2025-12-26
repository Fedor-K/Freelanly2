'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Settings, Cookie } from 'lucide-react';
import Link from 'next/link';

const CONSENT_COOKIE_NAME = 'cookie_consent';
const CONSENT_VERSION = 1;

interface ConsentState {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
  version: number;
}

function getVisitorId(): string {
  if (typeof window === 'undefined') return '';

  let visitorId = localStorage.getItem('visitor_id');
  if (!visitorId) {
    visitorId = 'v_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('visitor_id', visitorId);
  }
  return visitorId;
}

function getConsentFromCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null;

  const match = document.cookie.match(new RegExp(`${CONSENT_COOKIE_NAME}=([^;]+)`));
  if (match) {
    try {
      return JSON.parse(decodeURIComponent(match[1]));
    } catch {
      return null;
    }
  }
  return null;
}

function setConsentCookie(consent: ConsentState) {
  if (typeof document === 'undefined') return;

  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1); // 1 year
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(consent))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

export function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [consent, setConsent] = useState<ConsentState>({
    necessary: true,
    analytics: false,
    marketing: false,
    preferences: false,
    version: CONSENT_VERSION,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Check if consent already given
    const existingConsent = getConsentFromCookie();
    if (!existingConsent || existingConsent.version < CONSENT_VERSION) {
      // Show banner if no consent or outdated version
      setShowBanner(true);
    } else {
      setConsent(existingConsent);
    }
  }, []);

  const saveConsent = async (consentData: ConsentState) => {
    setSaving(true);

    // Save to cookie immediately
    setConsentCookie(consentData);
    setConsent(consentData);

    // Save to database
    try {
      await fetch('/api/cookie-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...consentData,
          visitorId: getVisitorId(),
        }),
      });
    } catch (error) {
      console.error('Failed to save consent to DB:', error);
    }

    setSaving(false);
    setShowBanner(false);
    setShowSettings(false);

    // Reload if analytics was just enabled (to initialize trackers)
    if (consentData.analytics) {
      window.location.reload();
    }
  };

  const acceptAll = () => {
    saveConsent({
      necessary: true,
      analytics: true,
      marketing: true,
      preferences: true,
      version: CONSENT_VERSION,
    });
  };

  const acceptNecessaryOnly = () => {
    saveConsent({
      necessary: true,
      analytics: false,
      marketing: false,
      preferences: false,
      version: CONSENT_VERSION,
    });
  };

  const saveSettings = () => {
    saveConsent(consent);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background border-t shadow-lg">
      <div className="container max-w-4xl mx-auto">
        {!showSettings ? (
          // Main banner
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-start gap-3 flex-1">
              <Cookie className="h-6 w-6 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm">
                  We use cookies to improve your experience. By continuing, you agree to our{' '}
                  <Link href="/privacy" className="underline hover:text-primary">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(true)}
              >
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={acceptNecessaryOnly}
                disabled={saving}
              >
                Reject All
              </Button>
              <Button
                size="sm"
                onClick={acceptAll}
                disabled={saving}
              >
                Accept All
              </Button>
            </div>
          </div>
        ) : (
          // Settings panel
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Cookie className="h-5 w-5" />
                Cookie Settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-muted rounded"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Necessary cookies */}
              <div className="flex items-start justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Necessary Cookies</p>
                  <p className="text-xs text-muted-foreground">
                    Required for the website to function. Cannot be disabled.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={true}
                  disabled
                  className="mt-1 h-4 w-4"
                />
              </div>

              {/* Analytics cookies */}
              <div className="flex items-start justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Analytics Cookies</p>
                  <p className="text-xs text-muted-foreground">
                    Help us understand how you use the website (Google Analytics, Yandex Metrika).
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.analytics}
                  onChange={(e) => setConsent({ ...consent, analytics: e.target.checked })}
                  className="mt-1 h-4 w-4"
                />
              </div>

              {/* Marketing cookies */}
              <div className="flex items-start justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Marketing Cookies</p>
                  <p className="text-xs text-muted-foreground">
                    Used for advertising and remarketing purposes.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.marketing}
                  onChange={(e) => setConsent({ ...consent, marketing: e.target.checked })}
                  className="mt-1 h-4 w-4"
                />
              </div>

              {/* Preferences cookies */}
              <div className="flex items-start justify-between gap-4 p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-sm">Preference Cookies</p>
                  <p className="text-xs text-muted-foreground">
                    Remember your settings like language and theme.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={consent.preferences}
                  onChange={(e) => setConsent({ ...consent, preferences: e.target.checked })}
                  className="mt-1 h-4 w-4"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={acceptNecessaryOnly}
                disabled={saving}
              >
                Reject All
              </Button>
              <Button
                size="sm"
                onClick={saveSettings}
                disabled={saving}
              >
                Save Settings
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Export helper to check consent status
export function hasAnalyticsConsent(): boolean {
  const consent = getConsentFromCookie();
  return consent?.analytics ?? false;
}

export function hasMarketingConsent(): boolean {
  const consent = getConsentFromCookie();
  return consent?.marketing ?? false;
}
