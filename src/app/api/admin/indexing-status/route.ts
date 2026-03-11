import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SignJWT, importPKCS8 } from 'jose';
import { siteConfig } from '@/config/site';

/**
 * Indexing Status & GSC Errors Check
 * GET /api/admin/indexing-status
 */

const SITE_URL = siteConfig.url;

interface GSCCredentials {
  client_email: string;
  private_key: string;
}

async function getAccessToken(scope: string): Promise<string | null> {
  const credentialsJson = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!credentialsJson) return null;

  try {
    const creds: GSCCredentials = JSON.parse(credentialsJson);
    const fixedKey = creds.private_key.replace(/PRIVATE\s+KEY/g, 'PRIVATE KEY');
    const privateKey = await importPKCS8(fixedKey, 'RS256');

    const jwt = await new SignJWT({ scope })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(creds.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    const data = await response.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

async function inspectUrl(accessToken: string, url: string): Promise<any> {
  try {
    const response = await fetch(
      'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          inspectionUrl: url,
          siteUrl: SITE_URL,
        }),
      }
    );
    return response.json();
  } catch (error) {
    return { error: String(error) };
  }
}

async function getSitemaps(accessToken: string): Promise<any> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(SITE_URL)}/sitemaps`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    return response.json();
  } catch (error) {
    return { error: String(error) };
  }
}

async function getCrawlErrors(accessToken: string): Promise<any> {
  // GSC API doesn't have direct crawl errors endpoint anymore
  // We'll use URL inspection on sample pages instead
  return { note: 'Crawl errors now checked via URL Inspection API' };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const adminSecret = process.env.CRON_SECRET;
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get tokens for both APIs
    const gscToken = await getAccessToken('https://www.googleapis.com/auth/webmasters.readonly');
    const indexingToken = await getAccessToken('https://www.googleapis.com/auth/indexing');

    // DB Stats
    const [totalJobs, richJobs, lightJobs, thinJobs, activeJobs, recentJobs] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { contentQuality: 'RICH', isActive: true } }),
      prisma.job.count({ where: { contentQuality: 'LIGHT', isActive: true } }),
      prisma.job.count({ where: { contentQuality: 'THIN', isActive: true } }),
      prisma.job.count({ where: { isActive: true } }),
      prisma.job.count({
        where: {
          isActive: true,
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ]);

    // Get sample jobs for inspection
    const sampleJobs = await prisma.job.findMany({
      where: { isActive: true, contentQuality: 'RICH' },
      select: { slug: true, title: true, company: { select: { slug: true, name: true } } },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    // Get sitemap status
    let sitemapStatus = null;
    if (gscToken) {
      sitemapStatus = await getSitemaps(gscToken);
    }

    // Inspect sample URLs
    const urlInspections: any[] = [];
    if (gscToken && sampleJobs.length > 0) {
      for (const job of sampleJobs.slice(0, 3)) {
        const url = `${SITE_URL}/company/${job.company.slug}/jobs/${job.slug}`;
        const inspection = await inspectUrl(gscToken, url);
        urlInspections.push({
          url: url.replace(SITE_URL, ''),
          title: job.title,
          company: job.company.name,
          result: inspection.inspectionResult || inspection.error || inspection,
        });
        // Rate limit
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Check dropped pages from GSC trend
    const droppedPagesCheck: any[] = [];
    if (gscToken) {
      const droppedUrls = [
        '/company/codetact-recruit',
        '/company/codetact-recruit/jobs',
        '/company/words-lead/jobs/english-german-translator-wordslead',
      ];

      for (const path of droppedUrls) {
        const url = `${SITE_URL}${path}`;
        const inspection = await inspectUrl(gscToken, url);
        droppedPagesCheck.push({
          url: path,
          indexStatus: inspection.inspectionResult?.indexStatusResult?.verdict || 'unknown',
          crawlStatus: inspection.inspectionResult?.indexStatusResult?.pageFetchState || 'unknown',
          lastCrawl: inspection.inspectionResult?.indexStatusResult?.lastCrawlTime || null,
          robotsTxt: inspection.inspectionResult?.indexStatusResult?.robotsTxtState || 'unknown',
          error: inspection.error,
        });
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Check indexing quota usage (via metadata endpoint)
    let indexingQuota = null;
    if (indexingToken && sampleJobs.length > 0) {
      try {
        const url = `${SITE_URL}/company/${sampleJobs[0].company.slug}/jobs/${sampleJobs[0].slug}`;
        const response = await fetch(
          `https://indexing.googleapis.com/v3/urlNotifications/metadata?url=${encodeURIComponent(url)}`,
          {
            headers: { Authorization: `Bearer ${indexingToken}` },
          }
        );
        indexingQuota = await response.json();
      } catch (e) {
        indexingQuota = { error: String(e) };
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),

      // Database stats
      dbStats: {
        totalJobs,
        activeJobs,
        byQuality: {
          rich: richJobs,
          light: lightJobs,
          thin: thinJobs,
        },
        recentJobs7d: recentJobs,
        note: 'Only RICH jobs are sent to Google Indexing API (200/day limit)',
      },

      // Sitemap status
      sitemaps: sitemapStatus,

      // URL Inspections (sample)
      urlInspections,

      // Dropped pages inspection
      droppedPages: droppedPagesCheck,

      // Indexing API status
      indexingApi: {
        hasCredentials: !!indexingToken,
        sampleUrlMetadata: indexingQuota,
      },

      // Recommendations
      recommendations: generateRecommendations(
        richJobs,
        urlInspections,
        droppedPagesCheck,
        sitemapStatus
      ),
    });
  } catch (error) {
    console.error('[IndexingStatus] Error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function generateRecommendations(
  richJobs: number,
  inspections: any[],
  droppedPages: any[],
  sitemaps: any
): string[] {
  const recs: string[] = [];

  if (richJobs < 50) {
    recs.push(`Only ${richJobs} RICH jobs - consider improving content quality for more jobs`);
  }

  const notIndexed = inspections.filter(
    (i) => i.result?.indexStatusResult?.verdict !== 'PASS'
  );
  if (notIndexed.length > 0) {
    recs.push(`${notIndexed.length} sample URLs not properly indexed - check URL inspection details`);
  }

  const deindexed = droppedPages.filter(
    (p) => p.indexStatus === 'FAIL' || p.crawlStatus === 'SOFT_404'
  );
  if (deindexed.length > 0) {
    recs.push(`${deindexed.length} previously-indexed pages now deindexed or returning soft 404`);
  }

  if (sitemaps?.sitemap) {
    const sitemapErrors = sitemaps.sitemap.filter((s: any) => s.errors > 0);
    if (sitemapErrors.length > 0) {
      recs.push(`Sitemap has ${sitemapErrors.length} errors - check sitemap configuration`);
    }
  }

  return recs;
}
