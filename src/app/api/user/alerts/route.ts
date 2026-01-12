import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AlertFrequency } from '@prisma/client';

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
      // Translation-specific: array of language codes user can translate
      languages,
    } = body as {
      category?: string;
      keywords?: string;
      country?: string;
      level?: string;
      languages?: string[];
    };

    // Require languages for translation category
    if (category === 'translation') {
      const validLanguages = languages?.filter((l) => l && l !== 'EN') || [];
      if (validLanguages.length === 0) {
        return NextResponse.json(
          { error: 'At least one language is required for translation alerts' },
          { status: 400 }
        );
      }
    }

    // Convert languages to pairs with English
    const languagePairs = languages ? languagesToPairs(languages) : [];

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
          category === 'translation' && languagePairs.length > 0
            ? {
                create: languagePairs.map((pair) => ({
                  translationType: pair.translationType,
                  sourceLanguage: pair.sourceLanguage,
                  targetLanguage: pair.targetLanguage,
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
