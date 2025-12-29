'use client';

import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to open subscription portal');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      alert('Failed to open subscription portal');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening...
        </>
      ) : (
        <>
          Manage Subscription
          <ExternalLink className="h-4 w-4" />
        </>
      )}
    </button>
  );
}
