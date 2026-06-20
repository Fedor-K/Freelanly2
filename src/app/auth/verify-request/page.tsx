'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';

function VerifyRequestContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (digit && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) submitCode(fullCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      submitCode(pasted);
    }
  };

  const submitCode = async (fullCode: string) => {
    if (!email) {
      setError('Email not found. Please try signing in again.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
        setTimeout(() => router.push(callbackUrl || data.callbackUrl || '/dashboard/discovery'), 1200);
      } else {
        setError(data.error || 'Invalid or expired code');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = () => {
    setCountdown(30);
    // Trigger resend by going back to signin
    window.location.href = `/auth/login?email=${encodeURIComponent(email)}`;
  };

  return (
    <div className="min-h-screen grid place-items-center px-5 py-8" style={{ background: '#F7F6F1' }}>
      <div
        className="w-full max-w-[460px] rounded-[18px] py-10 px-9 sm:px-10 text-center"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(11,12,15,0.07)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 36px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <a href="/" className="inline-flex items-center gap-2.5 font-semibold text-base tracking-tight mb-7">
          <span className="w-[30px] h-[30px] rounded-lg bg-[#0A0B0F] text-[#C7F94A] grid place-items-center font-mono font-bold text-sm">F</span>
          <span>Freelanly</span>
        </a>

        {/* Email icon */}
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-4 grid place-items-center"
          style={{ background: '#C7F94A', color: '#000' }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>

        {/* Eyebrow */}
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-[#6B7280] mb-3">
          — Step 2 of 2
        </div>

        <h1 className="text-[26px] font-medium tracking-tight leading-[1.2] mb-2.5">
          Check your inbox.
        </h1>
        <p className="text-[14.5px] text-[#5C6068] leading-relaxed mb-7">
          We sent a 6-digit code to <strong className="text-[#0A0B0F] font-medium">{email || 'your email'}</strong>.<br />
          It expires in 10 minutes.
        </p>

        {/* OTP input */}
        <form autoComplete="one-time-code">
          <div className="grid grid-cols-6 gap-2 max-w-[340px] mx-auto mb-4" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                disabled={loading || success}
                aria-label={`Digit ${index + 1}`}
                className="w-full aspect-[1/1.2] max-h-[60px] text-center font-mono text-2xl font-medium rounded-xl outline-none transition-all"
                style={{
                  background: digit ? '#F0EEE6' : '#FFFFFF',
                  border: `1.5px solid ${error ? 'rgba(185,28,28,0.4)' : digit ? '#5C6068' : 'rgba(11,12,15,0.14)'}`,
                  color: '#0A0B0F',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#0A0B0F';
                  e.target.style.transform = 'translateY(-1px)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(199,249,74,0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = digit ? '#5C6068' : 'rgba(11,12,15,0.14)';
                  e.target.style.transform = 'none';
                  e.target.style.boxShadow = 'none';
                }}
              />
            ))}
          </div>
        </form>

        {/* Error */}
        {error && <p className="text-[13px] text-red-600 mb-3">{error}</p>}

        {/* Success flash */}
        {success && (
          <div
            className="mx-auto mt-2 mb-3 py-3 px-4 rounded-[10px] text-[13px]"
            style={{ background: 'rgba(199,249,74,0.2)', color: '#0A0B0F', animation: 'slidein 200ms ease' }}
          >
            ✓ Code verified — redirecting to your workspace…
          </div>
        )}

        {/* Countdown / Resend */}
        <div className="mt-5">
          {countdown > 0 ? (
            <span
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-[12.5px] text-[#5C6068]"
              style={{ background: '#F0EEE6' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#5C6068]" />
              Resend in 0:{countdown.toString().padStart(2, '0')}
            </span>
          ) : (
            <button
              onClick={handleResend}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full font-mono text-[12.5px] cursor-pointer"
              style={{ background: 'rgba(199,249,74,0.2)', color: '#0A0B0F' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#4D8B0A] animate-pulse" />
              Resend code
            </button>
          )}
        </div>

        {/* Help */}
        <div className="mt-7 text-[12.5px] text-[#5C6068] leading-relaxed">
          Didn&apos;t get it? Check spam, or{' '}
          <a href="/auth/login" className="text-[#0A0B0F] underline underline-offset-[3px] decoration-[#E6E3D8]">
            use a different email
          </a>.<br />
          Need help? <a href="mailto:hi@freelanly.com" className="text-[#0A0B0F] underline underline-offset-[3px] decoration-[#E6E3D8]">hi@freelanly.com</a>
        </div>

        {/* Back */}
        <a
          href="/auth/login"
          className="inline-flex items-center gap-1.5 mt-4 font-mono text-[13px] text-[#5C6068] hover:text-[#0A0B0F]"
        >
          ← Back to sign in
        </a>
      </div>

      <style jsx>{`
        @keyframes slidein { from { transform: translateY(6px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}

export default function VerifyRequestPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen grid place-items-center" style={{ background: '#F7F6F1' }}>
        <div className="animate-pulse text-[#8A8E96]">Loading...</div>
      </div>
    }>
      <VerifyRequestContent />
    </Suspense>
  );
}
