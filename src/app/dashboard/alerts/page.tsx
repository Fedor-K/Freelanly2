import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertsList } from './AlertsList';
import { categories, countries, levels } from '@/config/site';

export const metadata: Metadata = {
  title: 'Job Alerts | Freelanly',
  description: 'Manage your job alerts',
};

export default async function AlertsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin?callbackUrl=/dashboard/alerts');
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
            Get notified when new jobs match your criteria
          </p>
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
