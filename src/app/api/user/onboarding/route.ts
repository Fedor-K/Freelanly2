import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertFrequency } from '@prisma/client';

interface OnboardingRequest {
  categories: string[];
  country?: string;
  languages?: string[]; // Language codes user can translate (e.g., ['ES', 'RU'])
}

/**
 * Convert language codes to language pairs with English
 */
function languagesToPairs(languages: string[]) {
  const pairs: Array<{ translationType: string; sourceLanguage: string; targetLanguage: string }> = [];
  for (const lang of languages) {
    if (lang && lang !== 'EN') {
      pairs.push({ translationType: 'TRANSLATION', sourceLanguage: 'EN', targetLanguage: lang.toUpperCase() });
      pairs.push({ translationType: 'TRANSLATION', sourceLanguage: lang.toUpperCase(), targetLanguage: 'EN' });
    }
  }
  return pairs;
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
    const { categories, country, languages } = body;

    if (!categories || categories.length === 0) {
      return NextResponse.json(
        { error: 'At least one category is required' },
        { status: 400 }
      );
    }

    const userId = session.user.id;
    const email = session.user.email;

    // Convert languages to pairs with English
    const languagePairs = languages ? languagesToPairs(languages) : [];

    // Create job alerts for each category
    for (const category of categories) {
      const isTranslation = category === 'translation';
      const validPairs = isTranslation ? languagePairs : [];

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
