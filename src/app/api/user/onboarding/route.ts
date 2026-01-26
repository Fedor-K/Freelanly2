import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertFrequency } from '@prisma/client';

interface LanguagePair {
  translationType: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface OnboardingRequest {
  categories: string[];
  country?: string;
  languagePairs?: LanguagePair[]; // Full language pairs from frontend
}

/**
 * POST /api/user/onboarding
 * Complete onboarding for new Google OAuth users
 * Creates job alerts and clears needsOnboarding flag
 */
export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: OnboardingRequest = await request.json();
    const { categories, country, languagePairs } = body;

    if (!categories || categories.length === 0) {
      return NextResponse.json(
        { error: 'At least one category is required' },
        { status: 400 }
      );
    }

    // Validate language pairs for translation category
    // Filter valid pairs: must have both source and target languages
    const validPairs = (languagePairs || []).filter(
      (p) => p.sourceLanguage && p.targetLanguage
    );

    if (categories.includes('translation')) {
      if (validPairs.length === 0) {
        return NextResponse.json(
          { error: 'At least one language pair is required for translation alerts' },
          { status: 400 }
        );
      }
    }

    const userId = session.user.id;
    const email = session.user.email;

    // Create job alerts for each category
    for (const category of categories) {
      const isTranslation = category === 'translation';
      const pairsForAlert = isTranslation ? validPairs : [];

      // Check if alert already exists
      const existingAlert = await prisma.jobAlert.findFirst({
        where: { userId, category },
      });

      if (existingAlert) {
        console.log(`[Onboarding] Alert already exists for ${email} + ${category}`);
        continue;
      }

      await prisma.jobAlert.create({
        data: {
          userId,
          email,
          category,
          country: country || null,
          frequency: AlertFrequency.INSTANT,
          isActive: true,
          languagePairs:
            pairsForAlert.length > 0
              ? {
                  create: pairsForAlert.map((pair) => ({
                    translationType: pair.translationType,
                    sourceLanguage: pair.sourceLanguage,
                    targetLanguage: pair.targetLanguage,
                  })),
                }
              : undefined,
        },
      });

      console.log(`[Onboarding] Created INSTANT alert for ${email}: ${category}`);
    }

    // Clear needsOnboarding flag
    await prisma.user.update({
      where: { id: userId },
      data: { needsOnboarding: false },
    });

    console.log(`[Onboarding] Completed for ${email}, created ${categories.length} alerts`);

    return NextResponse.json({
      success: true,
      alertsCreated: categories.length,
    });
  } catch (error) {
    console.error('[Onboarding] Error:', error);
    return NextResponse.json({ error: 'Onboarding failed' }, { status: 500 });
  }
}
