'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface SaveJobButtonProps {
  jobId: string;
  initialSaved?: boolean;
  variant?: 'icon' | 'button';
  className?: string;
}

export function SaveJobButton({
  jobId,
  initialSaved = false,
  variant = 'icon',
  className = '',
}: SaveJobButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  // Fetch saved status on mount if logged in
  useEffect(() => {
    if (status === 'authenticated' && !initialSaved) {
      fetch(`/api/jobs/${jobId}/save`)
        .then((res) => res.json())
        .then((data) => setSaved(data.saved))
        .catch(console.error);
    }
  }, [jobId, status, initialSaved]);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (status !== 'authenticated') {
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    setLoading(true);
    try {
      const method = saved ? 'DELETE' : 'POST';
      const res = await fetch(`/api/jobs/${jobId}/save`, { method });
      const data = await res.json();
      setSaved(data.saved);
    } catch (error) {
      console.error('Error saving job:', error);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'button') {
    return (
      <button
        onClick={handleClick}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
          saved
            ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      >
        <svg
          className={`w-5 h-5 ${saved ? 'fill-purple-500' : 'fill-none'}`}
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        {saved ? 'Saved' : 'Save Job'}
      </button>
    );
  }

  // Icon variant
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title={saved ? 'Remove from saved' : 'Save job'}
      className={`p-2 rounded-full transition-colors ${
        saved
          ? 'text-purple-600 hover:bg-purple-50'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
      } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      <svg
        className={`w-5 h-5 ${saved ? 'fill-purple-500' : 'fill-none'}`}
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    </button>
  );
}
