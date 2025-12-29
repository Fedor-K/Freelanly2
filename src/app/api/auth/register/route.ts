import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AlertFrequency } from '@prisma/client';

interface LanguagePair {
  translationType: string;
  sourceLanguage: string;
  targetLanguage: string;
}

interface RegisterRequest {
  email: string;
  name?: string;
  categories: string[];
  country?: string;
  languagePairs?: LanguagePair[];
  jobId?: string; // Track which job triggered registration
}

/**
 * POST /api/auth/register
 *
 * Pre-registers user preferences before magic link authentication.
 * Creates JobAlerts for each selected category with INSTANT frequency.
 * Alerts are created with email only (no userId) - will be linked when user signs in.
 */
export async function POST(request: NextRequest) {
  try {
    const body: RegisterRequest = await request.json();
    const { email, name, categories, country, languagePairs, jobId } = body;

    // Validate required fields
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (!categories || categories.length === 0) {
      return NextResponse.json({ error: 'At least one category is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // User exists - just create alerts linked to their account
      console.log(`[Register] User ${normalizedEmail} already exists, creating alerts`);
      await createAlertsForUser(existingUser.id, normalizedEmail, categories, country, languagePairs);

      return NextResponse.json({
        success: true,
        message: 'Alerts created for existing user',
        isExisting: true,
      });
    }

    // New user flow: pre-create user record
    // NextAuth will find and use this user when they verify email
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: name || null,
        // Not verified yet - will be set when magic link is clicked
        emailVerified: null,
      },
    });

    console.log(`[Register] Created new user: ${normalizedEmail}`);

    // Create alerts for each category
    await createAlertsForUser(user.id, normalizedEmail, categories, country, languagePairs);

    // Track registration source (which job triggered it)
    if (jobId) {
      await prisma.applyAttempt.create({
        data: {
          userId: user.id,
          jobId,
        },
      }).catch(() => {
        // Non-critical - don't fail registration if tracking fails
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Check your email for login link.',
      alertsCreated: categories.length,
    });
  } catch (error) {
    console.error('[Register] Error:', error);

    // Check for unique constraint violation (user already exists)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json(
        { error: 'This email is already registered. Please sign in.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}

/**
 * Create job alerts for a user
 */
async function createAlertsForUser(
  userId: string,
  email: string,
  categories: string[],
  country?: string,
  languagePairs?: LanguagePair[]
) {
  const validTranslationTypes = [
    'WRITTEN',
    'INTERPRETATION',
    'LOCALIZATION',
    'EDITING',
    'TRANSCRIPTION',
    'SUBTITLING',
    'MT_POST_EDITING',
    'COPYWRITING',
  ];

  // Create one alert per category
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

    // Check if alert already exists for this user + category
    const existingAlert = await prisma.jobAlert.findFirst({
      where: {
        userId,
        category,
      },
    });

    if (existingAlert) {
      console.log(`[Register] Alert already exists for ${email} + ${category}, skipping`);
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
        // Add language pairs for translation category
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

    console.log(`[Register] Created INSTANT alert for ${email}: ${category}`);
  }
}
