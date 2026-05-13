import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AppShell } from '@/components/app/AppShell';
import { PendingRegistrationHandler } from '@/components/auth/PendingRegistrationHandler';

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
      select: { name: true, plan: true },
    });
    if (user) {
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
