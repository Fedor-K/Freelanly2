'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes('@')) {
      setError('Please enter a valid email');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check if user exists
      const checkRes = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const checkData = await checkRes.json();

      if (!checkData.exists) {
        // Redirect to signup
        window.location.href = `/auth/signin?email=${encodeURIComponent(email)}`;
        return;
      }

      // Send magic link / OTP
      const result = await signIn('email', {
        email,
        redirect: false,
        callbackUrl: callbackUrl || '/dashboard/discovery',
      });

      if (result?.error) {
        setError('Failed to send code. Please try again.');
      } else {
        setSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="text-center py-4">
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 grid place-items-center"
          style={{ background: '#C7F94A' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 className="text-[22px] font-medium tracking-tight mb-2">Check your inbox.</h2>
        <p className="text-[14px] text-[#5C6068]">
          We sent a 6-digit code to <strong className="text-[#0A0B0F]">{email}</strong>.<br />
          It expires in 10 minutes.
        </p>
        <div className="mt-5 text-[12.5px] text-[#5C6068]">
          Didn&apos;t get it? Check spam, or{' '}
          <button onClick={() => setSent(false)} className="text-[#0A0B0F] underline underline-offset-[3px]">
            use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Email form (Google OAuth removed — email is the only sign-in method) */}
      <form onSubmit={handleSubmit}>
        <label className="block text-[11px] font-medium font-mono uppercase tracking-[0.06em] text-[#2F3138] mb-1.5">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@inbox.com"
          autoComplete="email"
          className="w-full px-3.5 py-3 rounded-[10px] text-[14.5px] outline-none transition-colors"
          style={{ background: '#FFFFFF', border: '1px solid rgba(11,12,15,0.12)' }}
          onFocus={e => (e.target.style.borderColor = '#0A0B0F')}
          onBlur={e => (e.target.style.borderColor = 'rgba(11,12,15,0.12)')}
        />
        <div className="text-[12px] text-[#5C6068] mt-1.5">
          We&apos;ll send a code to this address.
        </div>

        {error && (
          <div className="mt-3 text-[13px] text-red-600">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !email.includes('@')}
          className="w-full mt-4 py-3.5 px-4 rounded-[11px] text-[14.5px] font-medium flex items-center justify-center gap-2 transition-transform hover:-translate-y-px disabled:opacity-50 cursor-pointer"
          style={{ background: '#C7F94A', color: '#000' }}
        >
          {loading ? 'Sending...' : 'Send 6-digit code'}
          {!loading && <span className="transition-transform group-hover:translate-x-0.5">→</span>}
        </button>
      </form>
    </div>
  );
}
