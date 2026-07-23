import { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { OnboardingClient } from '@/components/app/OnboardingClient';
import '../design-app.css';
import './onboarding-design.css';

export const metadata: Metadata = {
  title: 'Welcome — Freelanly',
};

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/signin');

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, resumeUrl: true, resumeText: true, parsedProfile: true, linkedinUrl: true },
  });

  // Profile already unlocked (résumé/CV on file) → nothing to onboard, go to the feed.
  // (Was needsOnboarding-flag based — but the résumé-less Google-path users this page exists FOR
  // often have needsOnboarding=false and were bounced to cluttered settings instead. resumeUrl is
  // the actual gate every dashboard page checks, so it's the truth here too.)
  if (user?.resumeUrl) redirect('/dashboard/discovery');

  const hasResume = !!(user?.resumeText || user?.parsedProfile);
  const hasLinkedin = !!user?.linkedinUrl;
  const firstName = user?.name?.split(' ')[0] || 'there';

  return <OnboardingClient firstName={firstName} email={user?.email || ''} hasResume={hasResume} hasLinkedin={hasLinkedin} />;
}
