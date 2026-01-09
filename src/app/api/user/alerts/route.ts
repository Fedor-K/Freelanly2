import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertFrequency } from '@prisma/client';

// Language pair type
interface LanguagePair {
  translationType: string;
  sourceLanguage: string;
  targetLanguage: string;
}

// GET /api/user/alerts - Get user's job alerts with language pairs
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await prisma.jobAlert.findMany({
      where: { userId: session.user.id },
      include: {
        languagePairs: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('[API] Error getting alerts:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// POST /api/user/alerts - Create a new job alert
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      category,
      keywords,
      country,
      level,
      frequency,
      // Translation-specific: array of language pairs
      languagePairs,
    } = body as {
      category?: string;
      keywords?: string;
      country?: string;
      level?: string;
      frequency?: string;
      languagePairs?: LanguagePair[];
    };

    // All alerts are INSTANT now - ignore frequency parameter

    // Validate translation types if provided
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

    // Require language pairs for translation category
    if (category === 'translation') {
      const validPairs = languagePairs?.filter(
        (p) => p.sourceLanguage && p.targetLanguage && p.sourceLanguage !== p.targetLanguage
      ) || [];
      if (validPairs.length === 0) {
        return NextResponse.json(
          { error: 'At least one language pair is required for translation alerts' },
          { status: 400 }
        );
      }
    }

    if (languagePairs && languagePairs.length > 0) {
      for (const pair of languagePairs) {
        if (!validTranslationTypes.includes(pair.translationType)) {
          return NextResponse.json(
            { error: `Invalid translation type: ${pair.translationType}` },
            { status: 400 }
          );
        }
        if (!pair.sourceLanguage || !pair.targetLanguage) {
          return NextResponse.json(
            { error: 'Language pair must have both source and target language' },
            { status: 400 }
          );
        }
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create alert with language pairs
    const alert = await prisma.jobAlert.create({
      data: {
        userId: session.user.id,
        email: user.email,
        category: category || null,
        keywords: keywords?.trim() || null,
        country: country || null,
        level: level || null,
        frequency: AlertFrequency.INSTANT, // All alerts are INSTANT
        isActive: true,
        // Create language pairs if translation category
        languagePairs:
          category === 'translation' && languagePairs && languagePairs.length > 0
            ? {
                create: languagePairs.map((pair) => ({
                  translationType: pair.translationType,
                  sourceLanguage: pair.sourceLanguage.toUpperCase(),
                  targetLanguage: pair.targetLanguage.toUpperCase(),
                })),
              }
            : undefined,
      },
      include: {
        languagePairs: true,
      },
    });

    return NextResponse.json(alert);
  } catch (error) {
    console.error('[API] Error creating alert:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
