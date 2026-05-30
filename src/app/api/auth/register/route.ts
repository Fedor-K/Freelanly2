import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { AlertFrequency } from '@prisma/client';
import { rateLimit, getClientIp, sanitizeEmail, sanitizeString } from '@/lib/rate-limit';
import { validateEmail } from '@/lib/email-validator';

interface RegisterRequest {
  email: string;
  name?: string;
  categories: string[];
  country?: string; // Legacy single country (backwards compat)
  countries?: string[]; // New: multiple countries
  languages?: string[]; // Language codes user can translate (e.g., ['ES', 'RU'])
  jobId?: string; // Track which job triggered registration
  agreedToTerms?: boolean; // User agreed to ToS (for dispute evidence)
  gclid?: string; // Google Click ID for offline conversion tracking
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  source?: string; // Registration traffic source (utm_source)
  jobAlertOptIn?: boolean; // §4 scaffold — consent to future job-alert emails (sending suspended)
}

/**
 * Convert language codes to language pairs with English
 * e.g., ['ES', 'RU'] -> [{EN->ES}, {ES->EN}, {EN->RU}, {RU->EN}]
 */
function languagesToPairs(languages: string[]) {
  const pairs: Array<{ translationType: string; sourceLanguage: string; targetLanguage: string }> = [];
  for (const lang of languages) {
    if (lang && lang !== 'EN') {
      // Add bidirectional pairs with English
      pairs.push({ translationType: 'TRANSLATION', sourceLanguage: 'EN', targetLanguage: lang.toUpperCase() });
      pairs.push({ translationType: 'TRANSLATION', sourceLanguage: lang.toUpperCase(), targetLanguage: 'EN' });
    }
  }
  return pairs;
}

/**
 * POST /api/auth/register
 *
 * Pre-registers user preferences before magic link authentication.
 * Creates JobAlerts for each selected category × country with INSTANT frequency.
 * Alerts are created with email only (no userId) - will be linked when user signs in.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP: 5 requests per minute
    const ip = getClientIp(request.headers);
    const ipLimit = rateLimit('register_ip', ip, 5, 60_000);
    if (ipLimit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter) } }
      );
    }

    const body: RegisterRequest = await request.json();
    const { email, name, categories, country, countries, languages, jobId, agreedToTerms, gclid, source, utmMedium, utmCampaign, utmContent, jobAlertOptIn } = body;

    // Rate limit by email: 1 request per 10 minutes (prevent email bombing)
    const normalizedEmailForLimit = sanitizeEmail(email || '');
    if (normalizedEmailForLimit) {
      const emailLimit = rateLimit('register_email', normalizedEmailForLimit, 3, 120_000);
      if (emailLimit.limited) {
        return NextResponse.json(
          { error: 'Too many attempts. Please try again in 2 minutes.' },
          { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfter) } }
        );
      }
    }

    // Normalize countries: support both old `country` and new `countries` field
    const selectedCountries = countries && countries.length > 0
      ? countries
      : country ? [country] : [];

    // Validate required fields
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (!categories || categories.length === 0) {
      return NextResponse.json({ error: 'At least one category is required' }, { status: 400 });
    }

    // Validate languages for translation category
    if (categories.includes('translation')) {
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

    const normalizedEmail = sanitizeEmail(email);

    // Validate email domain (MX records)
    const emailCheck = await validateEmail(normalizedEmail);
    if (!emailCheck.valid) {
      return NextResponse.json(
        { error: emailCheck.reason || 'Invalid email address' },
        { status: 400 }
      );
    }

    // Sanitize name: strip HTML tags and control characters (XSS prevention)
    const sanitizedName = name ? sanitizeString(name).substring(0, 100) : null;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      // User exists - just create alerts linked to their account
      console.log(`[Register] User ${normalizedEmail} already exists, creating alerts`);

      // Save gclid/source if not already set
      const updateData: Record<string, string> = {};
      if (gclid && !existingUser.gclid) updateData.gclid = gclid;
      if (source && !existingUser.source) updateData.source = source;
      if (utmMedium && !existingUser.utmMedium) updateData.utmMedium = utmMedium;
      if (utmCampaign && !existingUser.utmCampaign) updateData.utmCampaign = utmCampaign;
      if (utmContent && !existingUser.utmContent) updateData.utmContent = utmContent;
      if (Object.keys(updateData).length > 0) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: updateData,
        });
      }

      await createAlertsForUser(existingUser.id, normalizedEmail, categories, selectedCountries, languagePairs);

      return NextResponse.json({
        success: true,
        message: 'Alerts created for existing user',
        isExisting: true,
      });
    }

    // New user flow: pre-create user record (upsert to handle race conditions)
    // NextAuth will find and use this user when they verify email
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {},
      create: {
        email: normalizedEmail,
        name: sanitizedName,
        // Not verified yet - will be set when magic link is clicked
        emailVerified: null,
        needsOnboarding: true,
        // Record ToS agreement for dispute evidence
        agreedToTermsAt: agreedToTerms ? new Date() : null,
        // Google Ads attribution
        gclid: gclid || null,
        // Traffic source
        source: source || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
      },
    });

    // §4 opt-in scaffold — captured via guarded raw SQL (column lives in DB, not the Prisma
    // model) so a not-yet-applied migration degrades to "opt-in skipped" instead of breaking
    // registration. Only write on explicit consent; sending stays suspended either way.
    if (jobAlertOptIn) {
      await prisma.$executeRaw`UPDATE "User" SET "jobAlertOptIn" = true, "jobAlertOptInAt" = NOW() WHERE "id" = ${user.id}`
        .catch((e) => console.warn('[register] jobAlertOptIn not persisted (migration pending?):', e?.message));
    }

    console.log(`[Register] Created new user: ${normalizedEmail}`);

    // Create alerts for each category × country
    await createAlertsForUser(user.id, normalizedEmail, categories, selectedCountries, languagePairs);

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
 * Create job alerts for a user.
 * Creates one alert per category × country combination.
 * If no countries selected, creates one alert per category with country=null (worldwide).
 */
async function createAlertsForUser(
  userId: string,
  email: string,
  categories: string[],
  countries: string[],
  languagePairs?: Array<{ translationType: string; sourceLanguage: string; targetLanguage: string }>
) {
  // If no countries, use [null] to create one worldwide alert per category
  const countryList: (string | null)[] = countries.length > 0 ? countries : [null];

  for (const category of categories) {
    const isTranslation = category === 'translation';
    const validPairs = isTranslation && languagePairs ? languagePairs : [];

    for (const country of countryList) {
      // Check if alert already exists for this user + category + country
      const existingAlert = await prisma.jobAlert.findFirst({
        where: {
          userId,
          category,
          country: country || null,
        },
      });

      if (existingAlert) {
        console.log(`[Register] Alert already exists for ${email} + ${category} + ${country || 'worldwide'}, skipping`);
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
                    sourceLanguage: pair.sourceLanguage,
                    targetLanguage: pair.targetLanguage,
                  })),
                }
              : undefined,
        },
      });

      console.log(`[Register] Created INSTANT alert for ${email}: ${category} (${country || 'worldwide'})`);
    }
  }
}
