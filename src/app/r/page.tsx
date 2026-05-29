import type { Metadata } from 'next';
import { RecruiterLoginForm } from '@/components/recruiter/RecruiterLoginForm';
import '../design-app.css';

export const metadata: Metadata = {
  title: 'Recruiter sign-in — Freelanly',
  robots: { index: false, follow: false },
};

// Passwordless re-entry to the recruiter portal. The /r/[token] link in application emails is
// the primary entry; this page lets a recruiter get that link again by email (no password),
// so the portal becomes a re-enterable account instead of an email-only door.
export default function RecruiterSignInPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: 'system-ui, sans-serif', color: '#0B0C0F' }}>
      <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg-1)', padding: '16px 24px' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto' }}><strong style={{ fontSize: '16px' }}>Freelanly</strong></div>
      </div>
      <div style={{ maxWidth: '480px', margin: '0 auto', padding: '40px 24px 64px' }}>
        <h1 style={{ fontSize: '22px', margin: '0 0 6px' }}>Open your candidate inbox</h1>
        <p className="meta" style={{ margin: '0 0 24px' }}>
          See who applied to your roles, view CVs and reply — no password.
        </p>
        <RecruiterLoginForm />
      </div>
    </div>
  );
}
