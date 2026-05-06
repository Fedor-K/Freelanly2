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

  // Check plan + resume profile
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, parsedProfile: true, freeAppliesUsedToday: true, lastFreeApplyReset: true },
  });

  if (!user) {
    redirect('/auth/signin');
  }

  // Reset daily free applies counter if new day
  const FREE_DAILY_LIMIT = 5;
  let freeAppliesRemaining = FREE_DAILY_LIMIT;
  if (user.plan === 'FREE') {
    const now = new Date();
    const lastReset = new Date(user.lastFreeApplyReset);
    const isNewDay = now.getUTCDate() !== lastReset.getUTCDate() ||
      now.getUTCMonth() !== lastReset.getUTCMonth() ||
      now.getUTCFullYear() !== lastReset.getUTCFullYear();
    if (isNewDay) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { freeAppliesUsedToday: 0, lastFreeApplyReset: now },
      });
      freeAppliesRemaining = FREE_DAILY_LIMIT;
    } else {
      freeAppliesRemaining = Math.max(0, FREE_DAILY_LIMIT - (user.freeAppliesUsedToday || 0));
    }
  }

  // Fetch all auto-apply data (gracefully handle missing tables before migration)
  let loops: any[] = [];
  let templates: any[] = [];
  let smtpConfig: any = null;
  let applications: any[] = [];
  const statsMap: Record<string, number> = {};
  let totalSent = 0;

  try {
    [loops, templates, smtpConfig, applications] = await Promise.all([
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
    ]);

    const stats = await prisma.autoApplication.groupBy({
      by: ['status'],
      where: { userId: session.user.id },
      _count: { status: true },
    });

    for (const s of stats) {
      statsMap[s.status] = s._count.status;
      totalSent += s._count.status;
    }
  } catch (e) {
    // Tables may not exist yet (before prisma db push)
    console.warn('[AutoApply] Tables not ready:', (e as Error).message?.substring(0, 100));
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
            opened: statsMap['OPENED'] || 0,
            replied: statsMap['REPLIED'] || 0,
            interview: statsMap['INTERVIEW'] || 0,
            failed: statsMap['FAILED'] || 0,
          }}
          countries={countries}
          levels={levels}
          parsedProfile={user?.parsedProfile as Record<string, unknown> | null}
          userPlan={user.plan}
          freeAppliesRemaining={freeAppliesRemaining}
          freeDailyLimit={FREE_DAILY_LIMIT}
        />
      </div>
    </div>
  );
}
