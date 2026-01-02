/**
 * Daily cron job to submit URLs to Google Indexing API
 * Limit: 200 URLs per day
 *
 * Priority order:
 * 1. New jobs (last 24 hours) - most important for freshness
 * 2. Updated jobs (last 7 days)
 * 3. Category pages
 * 4. Company pages with active jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';
import { SignJWT, importPKCS8 } from 'jose';

const DAILY_LIMIT = 200;

interface Credentials {
  client_email: string;
  private_key: string;
}

function getCredentials(): Credentials | null {
  const credentialsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!credentialsJson) return null;
  try {
    return JSON.parse(credentialsJson);
  } catch {
    return null;
  }
}

async function getAccessToken(creds: Credentials): Promise<string | null> {
  try {
    const privateKey = await importPKCS8(creds.private_key, 'RS256');

    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({
      scope: 'https://www.googleapis.com/auth/indexing',
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(creds.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    const data = await response.json();
    return data.access_token || null;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

async function submitUrl(accessToken: string, url: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url,
        type: 'URL_UPDATED',
      }),
    });

    const data = await response.json();
    if (data.error) {
      return { success: false, error: data.error.message };
    }
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creds = getCredentials();
    if (!creds) {
      return NextResponse.json({
        error: 'GOOGLE_INDEXING_CREDENTIALS not configured or invalid'
      }, { status: 400 });
    }

    const accessToken = await getAccessToken(creds);
    if (!accessToken) {
      return NextResponse.json({
        error: 'Failed to get access token'
      }, { status: 400 });
    }

  const results = {
    submitted: 0,
    failed: 0,
    urls: [] as string[],
    firstError: null as string | null,
  };

  let remaining = DAILY_LIMIT;

  // 1. Submit homepage and main pages first (5 URLs)
  const staticPages = [
    siteConfig.url,
    `${siteConfig.url}/jobs`,
    `${siteConfig.url}/companies`,
    `${siteConfig.url}/country`,
    `${siteConfig.url}/pricing`,
  ];

  for (const url of staticPages) {
    if (remaining <= 0) break;
    const result = await submitUrl(accessToken, url);
    if (result.success) {
      results.submitted++;
      results.urls.push(url);
    } else {
      results.failed++;
      if (!results.firstError) results.firstError = result.error || 'Unknown error';
    }
    remaining--;
    await new Promise(r => setTimeout(r, 100)); // Rate limit
  }

  // 2. Submit new jobs from last 24 hours (up to 100)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const newJobs = await prisma.job.findMany({
    where: {
      isActive: true,
      createdAt: { gte: oneDayAgo },
    },
    select: {
      slug: true,
      company: { select: { slug: true } },
    },
    take: Math.min(100, remaining),
    orderBy: { createdAt: 'desc' },
  });

  for (const job of newJobs) {
    if (remaining <= 0) break;
    const url = `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`;
    const result = await submitUrl(accessToken, url);
    if (result.success) {
      results.submitted++;
      results.urls.push(url);
    } else {
      results.failed++;
      if (!results.firstError) results.firstError = result.error || 'Unknown error';
    }
    remaining--;
    await new Promise(r => setTimeout(r, 100));
  }

  // 3. Submit category pages (21 categories)
  const categories = await prisma.category.findMany({
    select: { slug: true },
  });

  for (const cat of categories) {
    if (remaining <= 0) break;
    const url = `${siteConfig.url}/jobs/${cat.slug}`;
    const result = await submitUrl(accessToken, url);
    if (result.success) {
      results.submitted++;
      results.urls.push(url);
    } else {
      results.failed++;
      if (!results.firstError) results.firstError = result.error || 'Unknown error';
    }
    remaining--;
    await new Promise(r => setTimeout(r, 100));
  }

  // 4. Fill remaining with recent jobs
  if (remaining > 0) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentJobs = await prisma.job.findMany({
      where: {
        isActive: true,
        createdAt: { gte: sevenDaysAgo, lt: oneDayAgo },
      },
      select: {
        slug: true,
        company: { select: { slug: true } },
      },
      take: remaining,
      orderBy: { createdAt: 'desc' },
    });

    for (const job of recentJobs) {
      if (remaining <= 0) break;
      const url = `${siteConfig.url}/company/${job.company.slug}/jobs/${job.slug}`;
      const result = await submitUrl(accessToken, url);
      if (result.success) {
        results.submitted++;
        results.urls.push(url);
      } else {
        results.failed++;
        if (!results.firstError) results.firstError = result.error || 'Unknown error';
      }
      remaining--;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log(`Indexing API: Submitted ${results.submitted}/${DAILY_LIMIT} URLs, ${results.failed} failed`);

  return NextResponse.json({
    success: true,
    submitted: results.submitted,
    failed: results.failed,
    remaining: remaining,
    firstError: results.firstError,
  });
  } catch (error) {
    console.error('Indexing API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to trigger indexing',
    limit: DAILY_LIMIT,
  });
}
