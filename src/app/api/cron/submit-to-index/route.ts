import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { siteConfig } from '@/config/site';
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

interface SubmitResult {
  success: boolean;
  error?: string;
  code?: number;
}

async function submitUrl(token: string, url: string): Promise<SubmitResult> {
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

    if (data.error) {
      return {
        success: false,
        error: data.error.message || data.error.status,
        code: data.error.code
      };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
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

  // Pages that still exist (/jobs, /company, /country pages were removed).
  const urls: string[] = [
    siteConfig.url,
    `${siteConfig.url}/blog`,
    `${siteConfig.url}/pricing`,
    `${siteConfig.url}/how-it-works`,
    `${siteConfig.url}/features`,
    `${siteConfig.url}/about`,
  ];

  // Blog category pages
  const blogCategories = await prisma.blogCategory.findMany({ select: { slug: true } });
  for (const cat of blogCategories) {
    urls.push(`${siteConfig.url}/blog/category/${cat.slug}`);
  }

  // Published blog posts — the fresh content we actually want indexed
  const posts = await prisma.blogPost.findMany({
    where: { status: 'PUBLISHED' },
    select: { slug: true },
    take: 500,
    orderBy: { publishedAt: 'desc' },
  });
  const postUrls = posts.map((p) => `${siteConfig.url}/blog/${p.slug}`);

  // Google Indexing API: static + categories + posts, capped at the daily quota
  const googleUrls = [...urls, ...postUrls].slice(0, DAILY_LIMIT);

  let googleSubmitted = 0;
  let googleFailed = 0;
  const errors: Record<string, number> = {};

  for (const url of googleUrls) {
    const result = await submitUrl(token, url);
    if (result.success) {
      googleSubmitted++;
    } else {
      googleFailed++;
      const errorKey = result.error || 'unknown';
      errors[errorKey] = (errors[errorKey] || 0) + 1;
    }
    await new Promise(r => setTimeout(r, 100));
  }

  // Log to database
  await prisma.indexingLog.create({
    data: {
      provider: 'GOOGLE',
      urlsCount: googleUrls.length,
      success: googleSubmitted,
      failed: googleFailed,
      error: Object.keys(errors).length > 0 ? JSON.stringify(errors) : null,
    },
  }).catch(err => console.error('[submit-to-index] Failed to log:', err));

  // IndexNow (Bing, Yandex, etc.): static + categories + all posts
  const indexNowUrls = [...new Set([...urls, ...postUrls])]; // dedupe
  const indexNowResult = await submitToIndexNow(indexNowUrls);

  console.log(`[submit-to-index] Google: ${googleSubmitted}/${googleUrls.length} success, errors:`, errors);
  console.log(`[submit-to-index] IndexNow: ${indexNowUrls.length} URLs`);

  return NextResponse.json({
    google: {
      submitted: googleSubmitted,
      failed: googleFailed,
      total: googleUrls.length,
      blogPostsCount: postUrls.length,
      errors,
    },
    indexNow: { success: indexNowResult.success, urls: indexNowUrls.length },
    totalUrls: indexNowUrls.length,
  });
}

export async function GET() {
  return NextResponse.json({ message: 'POST to submit URLs', limit: DAILY_LIMIT });
}
