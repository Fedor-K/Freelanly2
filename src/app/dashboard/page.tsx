import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/auth/signin');
  }

  // Check if user has resume uploaded
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { resumeText: true, parsedProfile: true },
  });

  // If no resume yet, send to auto-apply setup (which starts with resume upload)
  // If resume exists, send to auto-apply dashboard
  redirect('/dashboard/auto-apply');
}
