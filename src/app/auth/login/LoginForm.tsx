'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = () => {
    signIn('google', { callbackUrl: callbackUrl || '/dashboard/auto-apply' });
  };

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
        callbackUrl: callbackUrl || '/dashboard/auto-apply',
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
      {/* Google OAuth */}
      <button
        onClick={handleGoogleSignIn}
        className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-[11px] text-[14px] font-medium transition-all cursor-pointer hover:bg-[#F0EEE6]"
        style={{ border: '1px solid rgba(11,12,15,0.12)', background: '#FFFFFF' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
        Continue with Google
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-4 font-mono text-[11px] tracking-[0.08em] uppercase text-[#6B7280]">
        <div className="flex-1 h-px" style={{ background: 'rgba(11,12,15,0.07)' }} />
        or use email
        <div className="flex-1 h-px" style={{ background: 'rgba(11,12,15,0.07)' }} />
      </div>

      {/* Email form */}
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
