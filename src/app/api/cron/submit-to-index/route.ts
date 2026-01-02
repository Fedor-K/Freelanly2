import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';
import { SignJWT, importPKCS8 } from 'jose';

const DAILY_LIMIT = 200;

async function getAccessToken(): Promise<string | null> {
  const credsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!credsJson) return null;

  try {
    const creds = JSON.parse(credsJson);
    const privateKey = await importPKCS8(creds.private_key, 'RS256');

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
  // Auth check
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get token
  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json({ error: 'Failed to get Google access token' }, { status: 500 });
  }

  // Collect URLs
  const urls: string[] = [
    siteConfig.url,
    `${siteConfig.url}/jobs`,
    `${siteConfig.url}/companies`,
    `${siteConfig.url}/pricing`,
  ];

  // Add recent jobs
  const recentJobs = await prisma.job.findMany({
    where: { isActive: true },
    select: { slug: true, company: { select: { slug: true } } },
    take: DAILY_LIMIT - urls.length,
    orderBy: { createdAt: 'desc' },
  });

  for (const job of recentJobs) {
    urls.push(`${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`);
  }

  // Submit
  let submitted = 0;
  for (const url of urls.slice(0, DAILY_LIMIT)) {
    if (await submitUrl(token, url)) submitted++;
    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({ submitted, total: urls.length });
}

export async function GET() {
  return NextResponse.json({ message: 'POST to submit URLs', limit: DAILY_LIMIT });
}
