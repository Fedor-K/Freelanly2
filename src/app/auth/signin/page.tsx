import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { RegistrationForm } from '@/components/auth/RegistrationForm';
import { TrustPanel } from './TrustPanel';

export const metadata: Metadata = {
  title: 'Sign Up — Freelanly',
  description: 'Apply to fresh gigs while you sleep. AI finds projects and auto-writes applications in your voice.',
};

interface SignInPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
  }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const params = await searchParams;

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2" style={{ background: '#F7F6F1' }}>
      {/* LEFT: Form */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-12">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2.5 font-semibold text-base tracking-tight mb-9">
          <span className="w-[30px] h-[30px] rounded-lg bg-[#0A0B0F] text-[#C7F94A] grid place-items-center font-mono font-bold text-sm">F</span>
          <span>Freelanly</span>
        </a>

        <div className="max-w-[440px] w-full mx-auto flex-1 flex flex-col justify-center">
          {/* Eyebrow */}
          <div className="font-mono text-[11px] tracking-[0.08em] uppercase text-[#6B7280] mb-3.5">
            — Start free · no card
          </div>

          <h1 className="text-[32px] font-medium tracking-tight leading-[1.1] mb-3">
            Apply to fresh<br/>gigs while you sleep.
          </h1>
          <p className="text-[15px] text-[#5C6068] leading-relaxed mb-7">
            Takes 60 seconds. We&apos;ll find 30+ matching projects per day and auto-write applications in your voice.
          </p>

          {/* Error message */}
          {params.error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {params.error === 'OAuthAccountNotLinked'
                ? 'This email is already used with a different sign in method.'
                : params.error === 'EmailSignin'
                  ? 'Failed to send email. Please try again.'
                  : 'An error occurred. Please try again.'}
            </div>
          )}

          {/* Registration form */}
          <RegistrationForm callbackUrl={params.callbackUrl} />

          {/* Legal */}
          <p className="text-[11.5px] text-[#6B7280] mt-4 leading-relaxed text-center">
            By signing up you agree to our{' '}
            <a href="/terms" className="text-[#2F3138] underline underline-offset-2 decoration-[#E6E3D8]">Terms</a> and{' '}
            <a href="/privacy" className="text-[#2F3138] underline underline-offset-2 decoration-[#E6E3D8]">Privacy Policy</a>.<br/>
            We don&apos;t share your résumé with employers — only the applications you approve.
          </p>
        </div>
      </div>

      {/* RIGHT: Trust panel */}
      <TrustPanel />
    </div>
  );
}
