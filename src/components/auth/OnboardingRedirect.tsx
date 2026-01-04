'use client';

import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Redirects users who need onboarding to the /onboarding page
 * Preserves the current URL as callbackUrl
 */
export function OnboardingRedirect() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Skip if still loading or not authenticated
    if (status !== 'authenticated' || !session?.user) return;

    // Skip if on onboarding page or auth pages
    if (pathname.startsWith('/onboarding') || pathname.startsWith('/auth')) return;

    // Skip API routes (shouldn't happen but just in case)
    if (pathname.startsWith('/api')) return;

    // Redirect to onboarding if needed
    if (session.user.needsOnboarding) {
      const callbackUrl = encodeURIComponent(pathname);
      router.push(`/onboarding?callbackUrl=${callbackUrl}`);
    }
  }, [session, status, pathname, router]);

  return null;
}
