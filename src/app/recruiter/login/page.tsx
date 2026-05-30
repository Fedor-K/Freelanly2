import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getRecruiterSession } from '@/lib/recruiter-session';
import { signRecruiterToken } from '@/lib/recruiter-token';
import { RecruiterLoginForm } from './LoginForm';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Recruiter login — Freelanly',
  robots: { index: false, follow: false },
};

// Already logged in? Skip straight into the portal.
export default async function RecruiterLoginPage() {
  const email = await getRecruiterSession();
  if (email) redirect(`/r/${signRecruiterToken(email)}`);

  return (
    <div style={{ minHeight: '100vh', background: '#FAF9F6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', border: '1px solid #E8E5DC', borderRadius: 14, padding: 32 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Freelanly</div>
        <h1 style={{ fontSize: 18, margin: '0 0 6px' }}>Open your candidate inbox</h1>
        <p style={{ fontSize: 13.5, color: '#8A8780', margin: '0 0 22px', lineHeight: 1.5 }}>
          Enter the email recruiters reach you at. We’ll send a 6-digit code — no password needed.
        </p>
        <RecruiterLoginForm />
      </div>
    </div>
  );
}
