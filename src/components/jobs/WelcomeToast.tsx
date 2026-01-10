'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

export function WelcomeToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const subscription = searchParams.get('subscription');
    const welcome = searchParams.get('welcome');

    if (subscription === 'success' && welcome === '1') {
      setShow(true);

      // Remove the query params from URL after showing toast
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('subscription');
      newUrl.searchParams.delete('welcome');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });

      // Auto-hide after 8 seconds
      const timer = setTimeout(() => setShow(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-xl shadow-lg max-w-md">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">Welcome to PRO!</h3>
            <p className="mt-1 text-green-100 text-sm">
              Browse jobs and start applying. Send 3 applications this week to maximize your chances!
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="flex-shrink-0 text-green-200 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
