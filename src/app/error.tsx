'use client';

import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 container py-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>

          {/* Show error details for debugging */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
            <p className="font-mono text-sm text-red-800 break-all">
              <strong>Error:</strong> {error.message}
            </p>
            {error.digest && (
              <p className="font-mono text-xs text-red-600 mt-2">
                <strong>Digest:</strong> {error.digest}
              </p>
            )}
            {error.stack && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-red-700">
                  Stack trace
                </summary>
                <pre className="mt-2 text-xs overflow-auto max-h-48 bg-red-100 p-2 rounded">
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          <div className="flex gap-4 justify-center">
            <Button onClick={() => reset()}>
              Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.href = '/'}>
              Go home
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
