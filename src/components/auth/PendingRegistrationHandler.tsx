'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Handles pending registration data after Google OAuth redirect.
 *
 * When user registers via Google, form data (categories, country, languagePairs)
 * is saved to sessionStorage before redirect. This component picks it up
 * after successful auth and creates job alerts.
 */
export function PendingRegistrationHandler() {
  const { data: session, status } = useSession();
  const processedRef = useRef(false);

  useEffect(() => {
    // Only run once when authenticated
    if (status !== 'authenticated' || !session?.user?.email || processedRef.current) {
      return;
    }

    const pendingData = sessionStorage.getItem('pendingRegistration');
    if (!pendingData) {
      return;
    }

    // Mark as processed to prevent duplicate calls
    processedRef.current = true;

    const processPendingRegistration = async () => {
      try {
        const data = JSON.parse(pendingData);

        // Validate data
        if (!data.categories || data.categories.length === 0) {
          console.log('[PendingRegistration] No categories, skipping');
          sessionStorage.removeItem('pendingRegistration');
          return;
        }

        console.log('[PendingRegistration] Processing:', {
          email: session.user.email,
          categories: data.categories,
          country: data.country,
        });

        // Send to register API to create alerts
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: session.user.email,
            name: data.name || session.user.name,
            categories: data.categories,
            country: data.country,
            languagePairs: data.languagePairs,
          }),
        });

        if (response.ok) {
          const result = await response.json();
          console.log('[PendingRegistration] Success:', result);
        } else {
          const error = await response.json();
          console.error('[PendingRegistration] Failed:', error);
        }
      } catch (error) {
        console.error('[PendingRegistration] Error:', error);
      } finally {
        // Always remove from storage
        sessionStorage.removeItem('pendingRegistration');
      }
    };

    processPendingRegistration();
  }, [status, session]);

  // This component doesn't render anything
  return null;
}
