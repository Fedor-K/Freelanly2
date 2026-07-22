import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';
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
  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, plan: true, applyCredits: true },
    });
    if (user) {
      userName = user.name || 'User';
      userPlan = user.plan;
      applyCredits = user.applyCredits ?? 0;
    }
  }

  return (
    <>
      <PendingRegistrationHandler />
      <AppShell userName={userName} userPlan={userPlan} applyCredits={applyCredits}>
        {children}
      </AppShell>
    </>
  );
}
