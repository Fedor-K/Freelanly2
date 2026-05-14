import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { RegistrationForm } from '@/components/auth/RegistrationForm';
import { TrustPanel } from './TrustPanel';
import './signup-design.css';

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
    <div className="auth-wrap">
      {/* LEFT: Form */}
      <div className="auth-form-side">
        <a href="/" className="auth-logo">
          <span className="auth-logo-mark">F</span>
          <span>Freelanly</span>
        </a>

        <div className="auth-form">
          <div className="auth-eyebrow">— Start free · no card</div>
          <h1 className="auth-title">Apply to fresh<br/>gigs while you sleep.</h1>
          <p className="auth-sub">Takes 60 seconds. We&apos;ll find 30+ matching projects per day and auto-write applications in your voice.</p>

          {/* Error message */}
          {params.error && (
            <div style={{marginBottom: '16px', padding: '12px', background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.18)', borderRadius: '10px', color: '#B91C1C', fontSize: '13px'}}>
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
          <div className="legal">
            By signing up you agree to our{' '}
            <a href="/terms">Terms</a> and{' '}
            <a href="/privacy">Privacy Policy</a>.<br/>
            We don&apos;t share your résumé with employers — only the applications you approve.
          </div>
        </div>
      </div>

      {/* RIGHT: Trust panel */}
      <TrustPanel />
    </div>
  );
}
