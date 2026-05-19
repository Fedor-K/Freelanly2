import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

/**
 * GET /api/user/onboarding — get current onboarding state
 * POST /api/user/onboarding — update step
 *
 * Steps:
 * 1. Background — role type selection + resume/LinkedIn upload
 * 2. Categories — what projects to match
 * 3. Email — connect SMTP or use Freelanly domain
 */

interface OnboardingState {
  currentStep: number;
  completed: boolean;
  steps: {
    background: { done: boolean; hasResume: boolean; hasLinkedIn: boolean; roleType: string | null };
    categories: { done: boolean; categories: string[]; skills: string[] };
    email: { done: boolean; hasSmtp: boolean; usingPostal: boolean };
  };
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        resumeText: true,
        parsedProfile: true,
        needsOnboarding: true,
        userSmtp: { select: { verified: true } },
        autoApplyLoops: { select: { id: true, jobTitles: true }, take: 1 },
        jobAlerts: { select: { category: true }, take: 10 },
      },
    });

    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const profile = user.parsedProfile as Record<string, unknown> | null;
    const hasResume = !!user.resumeText;
    const hasLinkedIn = !!profile?.linkedin;
    const hasSmtp = !!user.userSmtp?.verified;
    const categories = user.jobAlerts.map(a => a.category).filter(Boolean);
    const skills = (profile?.skills as string[]) || [];
    const roleType = (profile?.current_title as string) || (profile?.field as string) || null;
    const hasLoop = user.autoApplyLoops.length > 0;

    const step1Done = hasResume || !!profile;
    const step2Done = categories.length > 0 || hasLoop;
    const step3Done = hasSmtp || hasLoop; // postal users auto-have this

    let currentStep = 1;
    if (step1Done) currentStep = 2;
    if (step1Done && step2Done) currentStep = 3;
    if (step1Done && step2Done && step3Done) currentStep = 4; // all done

    const state: OnboardingState = {
      currentStep,
      completed: currentStep > 3,
      steps: {
        background: { done: step1Done, hasResume, hasLinkedIn, roleType },
        categories: { done: step2Done, categories, skills },
        email: { done: step3Done, hasSmtp, usingPostal: !hasSmtp && hasLoop },
      },
    };

    return NextResponse.json(state);
  } catch (error) {
    console.error('[Onboarding] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { step, data } = await request.json();

    if (step === 'background') {
      // data: { roleType: 'engineer' | 'designer' | 'marketer' | ... }
      const profile = (await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { parsedProfile: true },
      }))?.parsedProfile as Record<string, unknown> | null;

      await prisma.user.update({
        where: { id: session.user.id },
        data: {
          parsedProfile: { ...profile, field: data.roleType },
          needsOnboarding: false,
        },
      });

      return NextResponse.json({ success: true });
    }

    if (step === 'categories') {
      // data: { categories: ['engineering', 'design'] }
      // Create job alerts for selected categories
      for (const cat of data.categories || []) {
        const category = await prisma.category.findUnique({ where: { slug: cat } });
        if (category) {
          await prisma.jobAlert.upsert({
            where: {
              userId_email_category_keywords: {
                userId: session.user.id,
                email: session.user.email!,
                category: cat,
                keywords: '',
              },
            },
            update: {},
            create: {
              userId: session.user.id,
              email: session.user.email!,
              category: cat,
              frequency: 'INSTANT',
            },
          });
        }
      }

      return NextResponse.json({ success: true });
    }

    if (step === 'email') {
      // data: { method: 'postal' | 'skip' }
      // If postal — auto-create loop if not exists
      if (data.method === 'postal' || data.method === 'skip') {
        const existing = await prisma.autoApplyLoop.findFirst({
          where: { userId: session.user.id },
        });

        if (!existing) {
          const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { parsedProfile: true },
          });
          const profile = user?.parsedProfile as Record<string, unknown> | null;
          const titles = [(profile?.current_title as string) || (profile?.field as string) || 'Developer'].filter(Boolean);

          await prisma.autoApplyLoop.create({
            data: {
              userId: session.user.id,
              name: `${titles[0]} — Auto-Apply`,
              jobTitles: titles,
              keywords: ((profile?.skills as string[]) || []).slice(0, 5).join(', ') || null,
              dailyLimit: 10,
              mode: 'AUTO',
              isActive: true,
            },
          });
        }
      }

      return NextResponse.json({ success: true, completed: true });
    }

    if (step === 'complete') {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { needsOnboarding: false },
      });
      return NextResponse.json({ success: true, completed: true });
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
  } catch (error) {
    console.error('[Onboarding] Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
