import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { RegistrationForm } from '@/components/auth/RegistrationForm';
import { TrustPanel } from './TrustPanel';
import './signup-design.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Sign Up — Freelanly',
  description: 'AI finds matching gigs and writes a personalized application for each — you review and send in one click.',
};

interface SignInPageProps {
  searchParams: Promise<{
    callbackUrl?: string;
    error?: string;
    ref?: string;
    category?: string;
    country?: string;
    utm_content?: string;
    utm_source?: string;
    email?: string;
    projectId?: string;
    gmail?: string;
  }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  engineering: 'Engineering', design: 'Design', product: 'Product', marketing: 'Marketing',
  sales: 'Sales', data: 'Data & Analytics', devops: 'DevOps', qa: 'QA',
  writing: 'Writing & Content', translation: 'Translation', creative: 'Creative',
  support: 'Support', hr: 'HR', finance: 'Finance', legal: 'Legal',
  operations: 'Operations', education: 'Education', research: 'Research',
  consulting: 'Consulting', security: 'Security', 'project-management': 'Project Management',
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();
  const params = await searchParams;

  // Redirect social links to public project page
  if (params.utm_content && (params.utm_source === 'social' || params.ref === 'job')) {
    const opp = await prisma.opportunity.findUnique({
      where: { id: params.utm_content },
      select: { slug: true },
    }).catch(() => null);
    if (opp?.slug) {
      redirect(`/freelance/${opp.slug}?utm_source=${params.utm_source || 'social'}`);
    }
  }

  // A logged-in user must never see the signup form — that was the reported login
  // loop (verify code → /dashboard → no résumé → /auth/signin → signup form again).
  // Route them into the app: to résumé onboarding if they still need one.
  // EXCEPTION: fresh "Continue with Google" signup (?gmail=connected) — the session + verified email
  // + gmail.send grant already exist, but the profile (résumé + consent) doesn't. Render the form
  // jumped to the profile step instead of bouncing them to settings.
  let googleProfileStep: { email: string } | null = null;
  if (session?.user?.id) {
    const u = await prisma.user
      .findUnique({ where: { id: session.user.id }, select: { resumeUrl: true, email: true } })
      .catch(() => null);
    if (params.gmail === 'connected' && u && !u.resumeUrl) {
      googleProfileStep = { email: u.email };
    } else {
      redirect(u?.resumeUrl ? '/dashboard/discovery' : '/onboarding');
    }
  }

  // Personalized headline based on ref source
  let headline = 'Fresh gigs. Applications\nalready written.';
  let subtitle = "Takes 60 seconds. We find matching projects daily and pre-write every application — you just hit Send.";

  if (params.ref === 'jobs' || params.ref === 'freelance') {
    const category = params.category;
    const label = category ? CATEGORY_LABELS[category] || category : null;

    // Get real count
    const dayAgo = new Date(Date.now() - 24 * 3600000);
    const count = await prisma.opportunity.count({
      where: {
        isActive: true,
        createdAt: { gte: dayAgo },
        ...(category ? { category: { slug: category } } : {}),
      },
    }).catch(() => 0);

    if (label && count > 0) {
      headline = `${count}+ ${label} gigs\nfound this week.`;
      subtitle = `Sign up and we'll match you to ${label.toLowerCase()} roles — each with a personalized cover letter already written, ready to send.`;
    } else if (count > 0) {
      headline = `${count}+ fresh gigs\nfound today.`;
      subtitle = "Sign up and we'll match you to the right roles — each with a personalized cover letter already written, ready to send.";
    }
  } else if (params.ref === 'country') {
    const country = params.country;
    if (country) {
      headline = `Remote jobs in\n${country.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}.`;
      subtitle = "Sign up to get matched to remote roles — each with a personalized cover letter already written, ready to send.";
    }
  } else if (params.ref === 'job') {
    headline = "This job caught\nyour eye?";
    subtitle = "Sign up and we'll write your cover letter for this role — plus keep fresh matched gigs landing in your feed daily.";
  }

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
          <h1 className="auth-title">{headline.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br/>}</span>)}</h1>
          <p className="auth-sub">{subtitle}</p>

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
          <RegistrationForm
            callbackUrl={params.callbackUrl}
            prefillEmail={googleProfileStep?.email || params.email}
            initialStep={googleProfileStep ? 'profile' : undefined}
          />

          {/* Legal */}
          <div className="legal">
            By signing up you agree to our{' '}
            <a href="/terms">Terms</a> and{' '}
            <a href="/privacy">Privacy Policy</a>.<br/>
            Your profile is shared only with employers whose open roles match your background.
          </div>
        </div>
      </div>

      {/* RIGHT: Trust panel */}
      <TrustPanel />
    </div>
  );
}
