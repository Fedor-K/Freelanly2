'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px'}}>
      <div style={{textAlign: 'center', maxWidth: '400px'}}>
        <h1 style={{fontSize: '20px', fontWeight: 600, marginBottom: '12px'}}>Something went wrong</h1>
        <p style={{color: '#5C6068', fontSize: '14px', marginBottom: '20px'}}>{error.message}</p>
        <div style={{display: 'flex', gap: '8px', justifyContent: 'center'}}>
          <button onClick={() => reset()} style={{padding: '8px 16px', background: '#0A0B0F', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px'}}>Try again</button>
          <button onClick={() => window.location.href = '/'} style={{padding: '8px 16px', background: '#F0EEE6', color: '#0A0B0F', borderRadius: '8px', border: '1px solid rgba(11,12,15,0.12)', cursor: 'pointer', fontSize: '13px'}}>Go home</button>
        </div>
      </div>
    </div>
  );
}
