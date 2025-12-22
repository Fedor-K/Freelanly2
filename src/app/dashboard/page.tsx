import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Dashboard | Freelanly',
  description: 'Manage your saved jobs, applications, and settings',
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/signin');
  }

  // Fetch user stats
  const [savedJobsCount, applicationsCount, alertsCount] = await Promise.all([
    prisma.savedJob.count({
      where: { userId: session.user.id },
    }),
    prisma.application.count({
      where: { userId: session.user.id },
    }),
    prisma.jobAlert.count({
      where: { userId: session.user.id },
    }),
  ]);

  const user = session.user;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold">
            Hello, {user.name?.split(' ')[0] || 'there'}!
          </h1>
          <p className="mt-1 text-gray-600">
            Welcome to your dashboard
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Plan banner for FREE users */}
        {user.plan === 'FREE' && (
          <div className="mb-8 p-6 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Upgrade to PRO</h2>
                <p className="mt-1 text-purple-100">
                  Unlimited views, applications, and full salary insights
                </p>
              </div>
              <Link
                href="/pricing"
                className="px-6 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-purple-50 transition-colors"
              >
                Learn more
              </Link>
            </div>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Link
            href="/dashboard/saved"
            className="bg-white p-6 rounded-xl border hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{savedJobsCount}</p>
                <p className="text-gray-600">Saved Jobs</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/applications"
            className="bg-white p-6 rounded-xl border hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
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
              </div>
              <div>
                <p className="text-2xl font-bold">{applicationsCount}</p>
                <p className="text-gray-600">Applications</p>
              </div>
            </div>
          </Link>

          <Link
            href="/dashboard/alerts"
            className="bg-white p-6 rounded-xl border hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold">{alertsCount}</p>
                <p className="text-gray-600">Job Alerts</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Quick actions */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/jobs"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span>Find Jobs</span>
            </Link>
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg
                className="w-5 h-5 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span>Profile Settings</span>
            </Link>
          </div>
        </div>

        {/* Limits info for FREE users */}
        {user.plan === 'FREE' && (
          <div className="mt-8 bg-white rounded-xl border p-6">
            <h2 className="text-lg font-semibold mb-4">Your Limits</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Job views today</span>
                  <span className="font-medium">{user.jobViewsToday} / 5</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${Math.min((user.jobViewsToday / 5) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-500">
                Limits reset daily at midnight.{' '}
                <Link href="/pricing" className="text-purple-600 hover:underline">
                  Upgrade to PRO
                </Link>{' '}
                for unlimited access.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
