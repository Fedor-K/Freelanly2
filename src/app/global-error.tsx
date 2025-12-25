'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif' }}>
          <h1 style={{ color: '#dc2626' }}>Critical Error</h1>

          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '16px',
            marginTop: '20px'
          }}>
            <p style={{ fontFamily: 'monospace', fontSize: '14px', color: '#991b1b' }}>
              <strong>Error:</strong> {error.message}
            </p>
            {error.digest && (
              <p style={{ fontFamily: 'monospace', fontSize: '12px', color: '#b91c1c', marginTop: '8px' }}>
                <strong>Digest:</strong> {error.digest}
              </p>
            )}
            {error.stack && (
              <details style={{ marginTop: '16px' }}>
                <summary style={{ cursor: 'pointer', fontSize: '14px', color: '#b91c1c' }}>
                  Stack trace
                </summary>
                <pre style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  overflow: 'auto',
                  maxHeight: '200px',
                  background: '#fee2e2',
                  padding: '8px',
                  borderRadius: '4px'
                }}>
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button
              onClick={() => reset()}
              style={{
                padding: '10px 20px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Try again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '10px 20px',
                background: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
