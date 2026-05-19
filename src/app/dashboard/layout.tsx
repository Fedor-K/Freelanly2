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

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, plan: true, needsOnboarding: true },
    });
    if (user) {
      if (user.needsOnboarding !== false) {
        redirect('/onboarding');
      }
      userName = user.name || 'User';
      userPlan = user.plan;
    }
  }

  return (
    <>
      <PendingRegistrationHandler />
      <AppShell userName={userName} userPlan={userPlan}>
        {children}
      </AppShell>
    </>
  );
}
