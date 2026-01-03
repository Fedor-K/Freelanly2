import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { siteConfig, techStacks, categories } from '@/config/site';
import { SignJWT, importPKCS8 } from 'jose';
import { submitToIndexNow } from '@/lib/indexing';

const DAILY_LIMIT = 200;

async function getAccessToken(): Promise<string | null> {
  const credsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!credsJson) return null;

  try {
    const creds = JSON.parse(credsJson);
    // Fix malformed key (extra spaces in "PRIVATE    KEY")
    const fixedKey = creds.private_key.replace(/PRIVATE\s+KEY/g, 'PRIVATE KEY');
    const privateKey = await importPKCS8(fixedKey, 'RS256');

    const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/indexing' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(creds.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const data = await res.json();
    return data.access_token || null;
  } catch (e) {
    console.error('getAccessToken error:', e);
    return null;
  }
}

async function submitUrl(token: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url, type: 'URL_UPDATED' }),
    });
    const data = await res.json();

    // Check for error in response
    if (!res.ok || data.error) {
      const errMsg = data.error
        ? `${data.error.code}: ${data.error.message}`
        : `HTTP ${res.status}: ${JSON.stringify(data).slice(0, 100)}`;
      return { success: false, error: errMsg };
    }

    // Success = has urlNotificationMetadata
    if (data.urlNotificationMetadata) {
      return { success: true };
    }

    return { success: false, error: `Unexpected response: ${JSON.stringify(data).slice(0, 100)}` };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function POST(request: NextRequest) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getAccessToken();
  const hasGoogleCreds = !!process.env.GOOGLE_INDEXING_CREDENTIALS;

  if (!token && hasGoogleCreds) {
    return NextResponse.json({ error: 'Failed to get Google access token (creds present but token failed)' }, { status: 500 });
  }

  // Static pages
  const urls: string[] = [
    siteConfig.url,
    `${siteConfig.url}/jobs`,
    `${siteConfig.url}/companies`,
    `${siteConfig.url}/pricing`,
  ];

  // Add all skill pages (/jobs/skills/react, /jobs/skills/python, etc.)
  for (const tech of techStacks) {
    urls.push(`${siteConfig.url}/jobs/skills/${tech.slug}`);
  }

  // Add all category pages (/jobs/engineering, /jobs/design, etc.)
  for (const category of categories) {
    urls.push(`${siteConfig.url}/jobs/${category.slug}`);
  }

  const recentJobs = await prisma.job.findMany({
    where: { isActive: true },
    select: { slug: true, company: { select: { slug: true } } },
    take: DAILY_LIMIT - urls.length,
    orderBy: { createdAt: 'desc' },
  });

  for (const job of recentJobs) {
    urls.push(`${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`);
  }

  // Submit to Google Indexing API
  let googleSubmitted = 0;
  let googleFailed = 0;
  let googleErrors: string[] = [];
  let firstGoogleError: string | null = null;

  if (token) {
    for (const url of urls.slice(0, DAILY_LIMIT)) {
      const result = await submitUrl(token, url);
      if (result.success) {
        googleSubmitted++;
      } else {
        googleFailed++;
        if (result.error) {
          if (!firstGoogleError) {
            firstGoogleError = result.error;
          }
          if (googleErrors.length < 3) {
            googleErrors.push(`${url}: ${result.error}`);
          }
        }
      }
      await new Promise(r => setTimeout(r, 100));
    }
  } else {
    googleFailed = Math.min(urls.length, DAILY_LIMIT);
    firstGoogleError = 'No GOOGLE_INDEXING_CREDENTIALS configured';
    googleErrors.push(firstGoogleError);
  }

  // Log Google results to database
  await prisma.indexingLog.create({
    data: {
      provider: 'GOOGLE',
      urlsCount: Math.min(urls.length, DAILY_LIMIT),
      success: googleSubmitted,
      failed: googleFailed,
      error: firstGoogleError,
    },
  }).catch(err => console.error('Failed to log Google submission:', err));

  // Submit to IndexNow (Bing, Yandex, etc.) - all URLs at once
  const indexNowResult = await submitToIndexNow(urls);

  return NextResponse.json({
    google: {
      submitted: googleSubmitted,
      total: Math.min(urls.length, DAILY_LIMIT),
      errors: googleErrors.length > 0 ? googleErrors : undefined,
    },
    indexNow: { success: indexNowResult.success, urls: urls.length },
    totalUrls: urls.length,
  });
}

export async function GET() {
  return NextResponse.json({ message: 'POST to submit URLs', limit: DAILY_LIMIT });
}
