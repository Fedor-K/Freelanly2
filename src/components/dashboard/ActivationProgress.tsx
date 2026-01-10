'use client';

import Link from 'next/link';

const ACTIVATION_TARGET = 3;
const ACTIVATION_WINDOW_DAYS = 7;

interface ActivationProgressProps {
  applicationsCount: number;
  proStartedAt: Date | null;
  activatedAt: Date | null;
}

export function ActivationProgress({
  applicationsCount,
  proStartedAt,
  activatedAt,
}: ActivationProgressProps) {
  // Don't show if already activated
  if (activatedAt) {
    return null;
  }

  // Don't show if no proStartedAt (shouldn't happen for PRO users)
  if (!proStartedAt) {
    return null;
  }

  // Calculate days since becoming PRO
  const now = new Date();
  const daysSincePro = Math.floor(
    (now.getTime() - new Date(proStartedAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  // Don't show after 7 days
  if (daysSincePro >= ACTIVATION_WINDOW_DAYS) {
    return null;
  }

  const daysRemaining = ACTIVATION_WINDOW_DAYS - daysSincePro;
  const progress = Math.min(applicationsCount / ACTIVATION_TARGET, 1);
  const applicationsNeeded = Math.max(0, ACTIVATION_TARGET - applicationsCount);

  // Determine state and messaging
  const isComplete = applicationsCount >= ACTIVATION_TARGET;
  const isUrgent = daysRemaining <= 2 && !isComplete;

  return (
    <div
      className={`mb-8 p-6 rounded-xl border-2 ${
        isComplete
          ? 'bg-green-50 border-green-200'
          : isUrgent
          ? 'bg-orange-50 border-orange-200'
          : 'bg-blue-50 border-blue-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isComplete ? (
              <svg
                className="w-6 h-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className={`w-6 h-6 ${isUrgent ? 'text-orange-600' : 'text-blue-600'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            )}
            <h2
              className={`text-lg font-semibold ${
                isComplete
                  ? 'text-green-800'
                  : isUrgent
                  ? 'text-orange-800'
                  : 'text-blue-800'
              }`}
            >
              {isComplete
                ? 'Great job! You\'re on track!'
                : isUrgent
                ? 'Don\'t miss out!'
                : 'Get started with your job search'}
            </h2>
          </div>

          <p
            className={`mt-2 ${
              isComplete
                ? 'text-green-700'
                : isUrgent
                ? 'text-orange-700'
                : 'text-blue-700'
            }`}
          >
            {isComplete
              ? `You've sent ${applicationsCount} applications. Keep applying to find your perfect job!`
              : applicationsNeeded === ACTIVATION_TARGET
              ? `Send your first ${ACTIVATION_TARGET} applications to maximize your chances of landing a job.`
              : `${applicationsNeeded} more application${applicationsNeeded !== 1 ? 's' : ''} to go! ${
                  isUrgent ? `Only ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left.` : ''
                }`}
          </p>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1">
              <span
                className={
                  isComplete
                    ? 'text-green-600'
                    : isUrgent
                    ? 'text-orange-600'
                    : 'text-blue-600'
                }
              >
                {applicationsCount} / {ACTIVATION_TARGET} applications
              </span>
              {!isComplete && (
                <span className="text-gray-500">
                  {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                </span>
              )}
            </div>
            <div className="h-3 bg-white rounded-full overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isComplete
                    ? 'bg-green-500'
                    : isUrgent
                    ? 'bg-orange-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>

        {!isComplete && (
          <Link
            href="/jobs"
            className={`ml-4 px-6 py-3 rounded-lg font-medium whitespace-nowrap transition-colors ${
              isUrgent
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Find Jobs
          </Link>
        )}
      </div>
    </div>
  );
}
