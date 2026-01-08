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
  languagePairs?: LanguagePair[];
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

    const userId = session.user.id;
    const email = session.user.email;

    const validTranslationTypes = [
      'TRANSLATION',
      'INTERPRETATION',
      'LOCALIZATION',
      'EDITING',
      'TRANSCRIPTION',
      'SUBTITLING',
      'MT_POST_EDITING',
      'COPYWRITING',
    ];

    // Create job alerts for each category
    for (const category of categories) {
      const isTranslation = category === 'translation';

      // Filter valid language pairs for translation category
      const validPairs =
        isTranslation && languagePairs
          ? languagePairs.filter(
              (pair) =>
                validTranslationTypes.includes(pair.translationType) &&
                pair.sourceLanguage &&
                pair.targetLanguage
            )
          : [];

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
            validPairs.length > 0
              ? {
                  create: validPairs.map((pair) => ({
                    translationType: pair.translationType,
                    sourceLanguage: pair.sourceLanguage.toUpperCase(),
                    targetLanguage: pair.targetLanguage.toUpperCase(),
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
