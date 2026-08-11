import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';
import { FREE_APPLICATIONS } from '@/lib/apply-quota';
import { PendingRegistrationHandler } from '@/components/auth/PendingRegistrationHandler';
import '../design-app.css';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  let userName = 'User';
  let userPlan = 'FREE';
  let applyCredits = 0;
  let freeRemaining = FREE_APPLICATIONS;
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, plan: true, applyCredits: true, freeSendsUsed: true },
    });
    if (user) {
      userName = user.name || 'User';
      userPlan = user.plan;
      applyCredits = user.applyCredits ?? 0;
      freeRemaining = Math.max(0, FREE_APPLICATIONS - (user.freeSendsUsed ?? 0));
    }
  }

  return (
    <>
      <PendingRegistrationHandler />
      <AppShell userName={userName} userPlan={userPlan} applyCredits={applyCredits} freeRemaining={freeRemaining}>
        {children}
      </AppShell>
    </>
  );
}
