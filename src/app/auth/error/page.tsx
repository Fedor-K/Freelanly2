import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In Error',
  description: 'An error occurred during sign in',
};

interface ErrorPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

const errorMessages: Record<string, string> = {
  Configuration: 'Server configuration error. Please contact support.',
  AccessDenied: 'Access denied.',
  Verification: 'The sign in link has expired or has already been used.',
  OAuthSignin: 'Error signing in with Google. Please try again.',
  OAuthCallback: 'Error signing in with Google. Please try again.',
  OAuthCreateAccount: 'Could not create account. Please try a different sign in method.',
  EmailCreateAccount: 'Could not create account. Please try again.',
  Callback: 'Error signing in. Please try again.',
  OAuthAccountNotLinked:
    'This email is already used with a different sign in method. Please sign in with the method you originally used.',
  EmailSignin: 'Could not send email. Please check your email and try again.',
  CredentialsSignin: 'Invalid email or password.',
  SessionRequired: 'Please sign in to access this page.',
  Default: 'An error occurred. Please try again.',
};

export default async function AuthErrorPage({ searchParams }: ErrorPageProps) {
  const params = await searchParams;
  const error = params.error || 'Default';
  const errorMessage = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <a href="/" className="text-3xl font-bold text-black">
          Freelanly
        </a>

        {/* Error icon */}
        <div className="mt-8 w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-gray-900">
          Sign In Error
        </h1>

        <p className="mt-4 text-gray-600">{errorMessage}</p>

        <div className="mt-8 flex flex-col gap-3">
          <a
            href="/auth/signin"
            className="inline-block px-6 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Try again
          </a>
          <a
            href="/"
            className="inline-block text-gray-500 hover:text-gray-700 text-sm"
          >
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
