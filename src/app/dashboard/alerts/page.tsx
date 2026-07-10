import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertsList } from './AlertsList';
import { categories, countries, levels } from '@/config/site';

export const metadata: Metadata = {
  title: 'Job Alerts',
  description: 'Manage your job alerts',
};

export default async function AlertsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  const alerts = await prisma.jobAlert.findMany({
    where: { userId: session.user.id },
    include: {
      languagePairs: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Job Alerts</h1>
          <p className="text-gray-600 mt-1">
            Saved search criteria for your matches
          </p>
          <div className="mt-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-amber-800">
            Email alerts are currently <strong>paused</strong> — your saved criteria still shape your Discovery feed, but no alert emails are being sent right now.
          </div>
        </div>

        <AlertsList
          initialAlerts={alerts}
          categories={categories}
          countries={countries}
          levels={levels}
        />
      </div>
    </div>
  );
}
