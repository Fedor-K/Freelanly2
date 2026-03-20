'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTracker } from '@/hooks/useTracker';

/**
 * Automatically tracks PAGE_VIEW on every navigation.
 * Place inside SessionProvider in layout.tsx.
 */
export function TrackPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { track } = useTracker();
  const lastTracked = useRef<string>('');

  useEffect(() => {
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');

    // Avoid duplicate tracking for the same URL
    if (url === lastTracked.current) return;
    lastTracked.current = url;

    track('PAGE_VIEW', {
      url,
      referrer: document.referrer || undefined,
      // Capture UTM params if present
      ...(searchParams.get('utm_source') && { utm_source: searchParams.get('utm_source') }),
      ...(searchParams.get('utm_medium') && { utm_medium: searchParams.get('utm_medium') }),
      ...(searchParams.get('utm_campaign') && { utm_campaign: searchParams.get('utm_campaign') }),
      ...(searchParams.get('utm_content') && { utm_content: searchParams.get('utm_content') }),
    });
  }, [pathname, searchParams, track]);

  return null;
}
