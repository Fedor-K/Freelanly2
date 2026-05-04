import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AutoApplyDashboard } from './AutoApplyDashboard';
import { countries, levels } from '@/config/site';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Auto-Apply',
  description: 'Manage your auto-apply loops and applications',
};

export default async function AutoApplyPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Check plan
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  if (!user || user.plan === 'FREE') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Auto-Apply is a PRO Feature
            </h2>
            <p className="text-gray-600 mb-6">
              Upgrade to PRO to automatically apply to jobs matching your criteria.
              Set up loops, templates, and let Freelanly send applications for you.
            </p>
            <Link
              href="/pricing"
              className="inline-block px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Upgrade to PRO
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Fetch all auto-apply data
  const [loops, templates, smtpConfig, applications, stats] = await Promise.all([
    prisma.autoApplyLoop.findMany({
      where: { userId: session.user.id },
      include: { applications: { select: { id: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.coverLetterTemplate.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userSmtp.findFirst({
      where: { userId: session.user.id },
    }),
    prisma.autoApplication.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId: session.user.id },
      _count: { status: true },
    }),
  ]);

  // Build stats object
  const statsMap: Record<string, number> = {};
  let totalSent = 0;
  for (const s of stats) {
    statsMap[s.status] = s._count.status;
    totalSent += s._count.status;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Auto-Apply</h1>
          <p className="text-gray-600 mt-1">
            Automatically apply to jobs matching your criteria
          </p>
        </div>

        <AutoApplyDashboard
          initialLoops={loops}
          initialTemplates={templates}
          initialSmtp={smtpConfig}
          initialApplications={applications}
          stats={{
            total: totalSent,
            pending: statsMap['PENDING'] || 0,
            sent: statsMap['SENT'] || 0,
            replied: statsMap['REPLIED'] || 0,
            interview: statsMap['INTERVIEW'] || 0,
            failed: statsMap['FAILED'] || 0,
          }}
          countries={countries}
          levels={levels}
        />
      </div>
    </div>
  );
}
