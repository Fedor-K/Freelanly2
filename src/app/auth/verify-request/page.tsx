import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Check your email',
  description: 'We sent you a sign in link',
};

export default function VerifyRequestPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <a href="/" className="text-3xl font-bold text-black">
          Freelanly
        </a>

        {/* Email icon */}
        <div className="mt-8 w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-gray-900">
          Check your email
        </h1>

        <p className="mt-4 text-gray-600">
          We sent you a sign in link.
          <br />
          Click the link to sign in to your account.
        </p>

        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <p className="text-sm text-gray-600">
            Didn&apos;t receive the email? Check your spam folder or{' '}
            <a href="/auth/signin" className="text-black underline hover:no-underline">
              try again
            </a>
          </p>
        </div>

        <a
          href="/"
          className="mt-8 inline-block text-gray-500 hover:text-gray-700 text-sm"
        >
          ← Back to home
        </a>
      </div>
    </div>
  );
}
