'use client';

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

const CALLBACK_STORAGE_KEY = 'onboarding-callback-url';

/**
 * Redirects users who need onboarding to the /onboarding page
 * Uses stored callbackUrl from before sign-in, or current pathname
 */
export function OnboardingRedirect() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Store current URL before any sign-in (for later use in onboarding)
  useEffect(() => {
    // Don't store onboarding, auth, or dashboard pages
    if (
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/auth') ||
      pathname.startsWith('/dashboard') ||
      pathname.startsWith('/api')
    ) {
      return;
    }

    // Store the current URL as potential callback
    sessionStorage.setItem(CALLBACK_STORAGE_KEY, pathname);
  }, [pathname]);

  useEffect(() => {
    // Skip if still loading or not authenticated
    if (status !== 'authenticated' || !session?.user) return;

    // Skip if on onboarding page or auth pages
    if (pathname.startsWith('/onboarding') || pathname.startsWith('/auth')) return;

    // Skip API routes
    if (pathname.startsWith('/api')) return;

    // Redirect to onboarding if needed
    if (session.user.needsOnboarding) {
      // Try to get stored callback URL (from before sign-in)
      const storedCallback = sessionStorage.getItem(CALLBACK_STORAGE_KEY);
      const callbackUrl = storedCallback || pathname;

      router.push(`/onboarding?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }, [session, status, pathname, router]);

  return null;
}

/**
 * Call this before initiating sign-in to store the intended destination
 */
export function storeCallbackUrl(url: string) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(CALLBACK_STORAGE_KEY, url);
  }
}
