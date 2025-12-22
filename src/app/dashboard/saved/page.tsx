import { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { formatDistanceToNow } from '@/lib/utils';
import { SaveJobButton } from '@/components/jobs/SaveJobButton';

export const metadata: Metadata = {
  title: 'Saved Jobs | Freelanly',
  description: 'View your saved jobs',
};

export default async function SavedJobsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard/saved');
  }

  const savedJobs = await prisma.savedJob.findMany({
    where: { userId: session.user.id },
    include: {
      job: {
        include: {
          company: true,
          category: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Saved Jobs</h1>
            <p className="text-gray-600 mt-1">
              {savedJobs.length} {savedJobs.length === 1 ? 'job' : 'jobs'} saved
            </p>
          </div>
          <Link
            href="/jobs"
            className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Find More Jobs
          </Link>
        </div>

        {savedJobs.length === 0 ? (
          <div className="bg-white rounded-xl border p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No saved jobs yet
            </h2>
            <p className="text-gray-600 mb-6">
              Save jobs you&apos;re interested in to review them later
            </p>
            <Link
              href="/jobs"
              className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Browse Jobs
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {savedJobs.map(({ job, createdAt }) => (
              <div
                key={job.id}
                className="bg-white rounded-xl border p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Company logo */}
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {job.company?.logo ? (
                      <img
                        src={job.company.logo}
                        alt={job.company.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-gray-400">
                        {job.company?.name?.charAt(0) || 'J'}
                      </span>
                    )}
                  </div>

                  {/* Job info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/company/${job.company?.slug}/jobs/${job.slug}`}
                      className="text-lg font-semibold text-gray-900 hover:text-purple-600 transition-colors"
                    >
                      {job.title}
                    </Link>
                    <p className="text-gray-600 mt-1">
                      {job.company?.name}
                      {job.location && (
                        <span className="text-gray-400"> · {job.location}</span>
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {job.category && (
                        <span className="px-2 py-1 bg-purple-50 text-purple-700 text-xs rounded">
                          {job.category.name}
                        </span>
                      )}
                      {job.level && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {job.level}
                        </span>
                      )}
                      {job.type && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                          {job.type.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">
                      Saved {formatDistanceToNow(createdAt)}
                    </span>
                    <SaveJobButton jobId={job.id} initialSaved={true} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
