import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { SignInForm } from '@/components/auth/SignInForm';

export const metadata: Metadata = {
  title: 'Sign In | Freelanly',
  description: 'Sign in to your Freelanly account to access saved jobs and applications',
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

  // Already logged in - redirect to dashboard or callback URL
  if (session?.user) {
    redirect(params.callbackUrl || '/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <a href="/" className="text-3xl font-bold text-black">
            Freelanly
          </a>
          <h1 className="mt-6 text-2xl font-semibold text-gray-900">
            Sign in to your account
          </h1>
          <p className="mt-2 text-gray-600">
            Save jobs and track your applications
          </p>
        </div>

        {/* Error message */}
        {params.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">
              {params.error === 'OAuthAccountNotLinked'
                ? 'This email is already used with a different sign in method.'
                : params.error === 'EmailSignin'
                  ? 'Failed to send email. Please try again.'
                  : 'An error occurred. Please try again.'}
            </p>
          </div>
        )}

        {/* Sign in form */}
        <SignInForm callbackUrl={params.callbackUrl} />

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500">
          By continuing, you agree to our{' '}
          <a href="/terms" className="underline hover:text-gray-700">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="underline hover:text-gray-700">
            Privacy Policy
          </a>
        </p>
      </div>
    </div>
  );
}
