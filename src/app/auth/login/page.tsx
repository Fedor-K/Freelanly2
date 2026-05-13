import { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign In — Freelanly',
  description: 'Sign in to your Freelanly dashboard.',
};

interface LoginPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen grid place-items-center px-5 py-8" style={{ background: '#F7F6F1' }}>
      <div
        className="w-full max-w-[440px] rounded-[18px] p-9 sm:p-10"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(11,12,15,0.07)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.02), 0 8px 36px rgba(0,0,0,0.06)',
        }}
      >
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 font-semibold text-base tracking-tight mb-7">
          <span className="w-[30px] h-[30px] rounded-lg bg-[#0A0B0F] text-[#C7F94A] grid place-items-center font-mono font-bold text-sm">F</span>
          <span>Freelanly</span>
        </a>

        {/* Eyebrow */}
        <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-[#6B7280] mb-3">
          — Welcome back
        </div>

        <h1 className="text-[26px] font-medium tracking-tight leading-[1.15] mb-2">
          Sign in to your dashboard.
        </h1>
        <p className="text-[14px] text-[#5C6068] leading-relaxed mb-6">
          We&apos;ll email you a 6-digit code — no password to remember.
        </p>

        {/* Error */}
        {params.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {params.error === 'OAuthAccountNotLinked'
              ? 'This email is already used with a different sign in method.'
              : 'An error occurred. Please try again.'}
          </div>
        )}

        {/* Login Form */}
        <LoginForm callbackUrl={params.callbackUrl} />

        {/* Sign up link */}
        <div className="text-[13.5px] text-[#5C6068] mt-5 text-center">
          New to Freelanly?{' '}
          <a href="/auth/signin" className="text-[#0A0B0F] font-medium underline underline-offset-[3px] decoration-[#E6E3D8]">
            Create an account
          </a>
        </div>
      </div>
    </div>
  );
}
