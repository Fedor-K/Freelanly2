import type { Metadata } from 'next';
import { RecruiterLoginForm } from '@/components/recruiter/RecruiterLoginForm';
import { RecruiterTrustPanel } from '@/components/recruiter/RecruiterTrustPanel';
import '../auth/signin/signup-design.css';

export const metadata: Metadata = {
  title: 'Recruiter sign-in — Freelanly',
  robots: { index: false, follow: false },
};

// Passwordless re-entry to the recruiter portal, styled to match the candidate auth
// (auth-wrap / TrustPanel). The /r/[token] link in application emails is the primary
// entry; this lets a recruiter get that link again by email so the portal is a
// re-enterable account, not an email-only door.
export default function RecruiterSignInPage() {
  return (
    <div className="auth-wrap">
      <div className="auth-form-side">
        <a href="/" className="auth-logo">
          <span className="auth-logo-mark">F</span>
          <span>Freelanly</span>
        </a>

        <div className="auth-form">
          <div className="auth-eyebrow">— For recruiters · no password</div>
          <h1 className="auth-title">See who applied<br />to your roles.</h1>
          <p className="auth-sub">
            Enter your email and we’ll send a link to your candidate inbox — matched applicants, their CVs, and replies in one place.
          </p>

          <RecruiterLoginForm />

          <div className="legal">
            We email a sign-in link to your address — no password.<br />
            You only ever see candidates who applied to your own posts.
          </div>
        </div>
      </div>

      <RecruiterTrustPanel />
    </div>
  );
}
