import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { siteConfig, techStacks, categories } from '@/config/site';
import { SignJWT, importPKCS8 } from 'jose';
import { submitToIndexNow } from '@/lib/indexing';
import { isCronAuthorized, logUnauthorizedCronAttempt } from '@/lib/cron-auth';

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

async function submitUrl(token: string, url: string): Promise<boolean> {
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
    return !data.error;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    logUnauthorizedCronAttempt(request);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Failed to get Google access token' }, { status: 500 });
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

  // For Google: only RICH content jobs (to save 200/day quota)
  const richJobs = await prisma.job.findMany({
    where: {
      isActive: true,
      contentQuality: 'RICH',
    },
    select: { slug: true, company: { select: { slug: true } } },
    take: DAILY_LIMIT - urls.length,
    orderBy: { createdAt: 'desc' },
  });

  for (const job of richJobs) {
    urls.push(`${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`);
  }

  // For IndexNow: all active jobs (no daily limit)
  const allJobs = await prisma.job.findMany({
    where: { isActive: true },
    select: { slug: true, company: { select: { slug: true } } },
    take: 500, // reasonable batch size
    orderBy: { createdAt: 'desc' },
  });

  const allJobUrls = allJobs.map(
    (job) => `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`
  );

  // Submit to Google Indexing API (static pages + RICH jobs only)
  let googleSubmitted = 0;
  for (const url of urls.slice(0, DAILY_LIMIT)) {
    if (await submitUrl(token, url)) googleSubmitted++;
    await new Promise(r => setTimeout(r, 100));
  }

  // Submit to IndexNow (Bing, Yandex, etc.) - static pages + ALL jobs
  const indexNowUrls = [...new Set([...urls, ...allJobUrls])]; // dedupe
  const indexNowResult = await submitToIndexNow(indexNowUrls);

  return NextResponse.json({
    google: {
      submitted: googleSubmitted,
      total: Math.min(urls.length, DAILY_LIMIT),
      richJobsCount: richJobs.length,
    },
    indexNow: { success: indexNowResult.success, urls: indexNowUrls.length },
    totalUrls: indexNowUrls.length,
  });
}

export async function GET() {
  return NextResponse.json({ message: 'POST to submit URLs', limit: DAILY_LIMIT });
}
