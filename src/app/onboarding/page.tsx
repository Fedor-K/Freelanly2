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
    select: { name: true, resumeText: true, parsedProfile: true, needsOnboarding: true, linkedinUrl: true },
  });

  // Already completed onboarding → go to dashboard
  if (user?.needsOnboarding === false) redirect('/dashboard');

  const hasResume = !!(user?.resumeText || user?.parsedProfile);
  const hasLinkedin = !!user?.linkedinUrl;
  const firstName = user?.name?.split(' ')[0] || 'there';

  return <OnboardingClient firstName={firstName} hasResume={hasResume} hasLinkedin={hasLinkedin} />;
}
